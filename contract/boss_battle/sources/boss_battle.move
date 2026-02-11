module boss_battle::boss_battle {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::random::{Self, Random};
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    use std::string::{Self, String};

    // --- 错误代码 ---
    const ENotAlive: u64 = 0;
    const EInsufficientPayment: u64 = 1;
    const ENotYetRespawnTime: u64 = 2;
    const ENotRegistered: u64 = 3;

    // --- 核心对象 ---

    struct AdminCap has key { id: UID }

    struct Arena has key {
        id: UID,
        agents: Table<address, String>, // 修改为存储名称 String
    }

    struct Boss has key {
        id: UID,
        name: String,
        description: String,
        skill: String,
        difficulty: String,
        hp: u64,
        max_hp: u64,
        pool: Balance<SUI>,
        last_attacker: address,
        is_alive: bool,
        attack_cost: u64,
        death_time: u64, // 记录死亡时间（毫秒）
    }

    // --- 事件 ---

    struct AgentRegisteredEvent has copy, drop {
        agent_address: address,
        name: String, // 事件中也加入名称
    }

    struct BossCreatedEvent has copy, drop {
        boss_id: ID,
        name: String,
        hp: u64,
    }

    struct BossRespawnedEvent has copy, drop {
        boss_id: ID,
        name: String,
        new_hp: u64,
    }

    struct CombatEvent has copy, drop {
        boss_id: ID,
        attacker: address,
        damage: u64,
        remaining_hp: u64,
        is_kill: bool,
    }

    struct RewardEvent has copy, drop {
        winner: address,
        amount: u64,
        boss_id: ID,
    }

    // --- 初始化 ---

    fun init(ctx: &mut TxContext) {
        transfer::transfer(AdminCap { id: object::new(ctx) }, tx_context::sender(ctx));
        transfer::share_object(Arena {
            id: object::new(ctx),
            agents: table::new(ctx),
        });
    }

    // --- 核心业务函数 ---

    /// Agent 注册逻辑
    public entry fun register_agent(
        arena: &mut Arena,
        name: vector<u8>, // 接收名称参数
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let name_str = string::utf8(name);
        if (!table::contains(&arena.agents, sender)) {
            table::add(&mut arena.agents, sender, name_str);
            event::emit(AgentRegisteredEvent { 
                agent_address: sender,
                name: name_str 
            });
        };
    }

    /// 创建 Boss (仅管理员)
    public entry fun create_boss(
        _: &AdminCap,
        name: vector<u8>,
        description: vector<u8>,
        skill: vector<u8>,
        difficulty: vector<u8>,
        hp: u64,
        attack_cost: u64,
        ctx: &mut TxContext
    ) {
        let boss = Boss {
            id: object::new(ctx),
            name: string::utf8(name),
            description: string::utf8(description),
            skill: string::utf8(skill),
            difficulty: string::utf8(difficulty),
            hp,
            max_hp: hp,
            pool: balance::zero(),
            last_attacker: @0x0,
            is_alive: true,
            attack_cost,
            death_time: 0,
        };
        event::emit(BossCreatedEvent {
            boss_id: object::id(&boss),
            name: boss.name,
            hp: boss.hp,
        });
        transfer::share_object(boss);
    }

    /// 复活 Boss 逻辑 (可由任何人触发，只要时间到了)
    public entry fun respawn_boss(
        boss: &mut Boss,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(!boss.is_alive, 100); // 必须是已死亡状态
        let current_time = clock::timestamp_ms(clock);
        // 5 分钟 = 5 * 60 * 1000 = 300,000 毫秒
        assert!(current_time >= boss.death_time + 300000, ENotYetRespawnTime);

        boss.hp = boss.max_hp;
        boss.is_alive = true;
        boss.death_time = 0;

        event::emit(BossRespawnedEvent {
            boss_id: object::id(boss),
            name: boss.name,
            new_hp: boss.hp,
        });
    }

    /// Agent 攻击接口
    public entry fun attack_boss(
        arena: &Arena,
        boss: &mut Boss,
        payment: Coin<SUI>,
        r: &Random,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        // 校验注册状态
        assert!(table::contains(&arena.agents, sender), ENotRegistered);
        
        assert!(boss.is_alive, ENotAlive);
        assert!(coin::value(&payment) == boss.attack_cost, EInsufficientPayment);

        // 1. 资金入池
        let coin_balance = coin::into_balance(payment);
        balance::join(&mut boss.pool, coin_balance);

        // 2. 生成随机伤害 (1-10)
        let generator = random::new_generator(r, ctx);
        let damage = random::generate_u64_in_range(&mut generator, 1, 10);

        // 3. 更新状态
        if (damage >= boss.hp) {
            boss.hp = 0;
            boss.is_alive = false;
            boss.death_time = clock::timestamp_ms(clock); // 记录死亡时间
        } else {
            boss.hp = boss.hp - damage;
        };

        boss.last_attacker = sender;

        // 4. 抛出战斗事件
        event::emit(CombatEvent {
            boss_id: object::id(boss),
            attacker: sender,
            damage,
            remaining_hp: boss.hp,
            is_kill: !boss.is_alive,
        });

        // 5. 如果击杀，立即结算
        if (!boss.is_alive) {
            distribute_rewards(boss, ctx);
        }
    }

    /// 内部奖励分账逻辑 (90% 奖励给最后击杀者)
    fun distribute_rewards(boss: &mut Boss, ctx: &mut TxContext) {
        let total_amount = balance::value(&boss.pool);
        let winner_reward = (total_amount * 90) / 100;
        
        let winner_coin = coin::from_balance(balance::split(&mut boss.pool, winner_reward), ctx);
        transfer::public_transfer(winner_coin, boss.last_attacker);

        event::emit(RewardEvent {
            winner: boss.last_attacker,
            amount: winner_reward,
            boss_id: object::id(boss),
        });
    }

    /// 销毁 Boss (仅管理员，用于清理测试对象)
    public entry fun destroy_boss(
        _: &AdminCap,
        boss: Boss,
        ctx: &mut TxContext
    ) {
        let Boss {
            id,
            name: _,
            description: _,
            skill: _,
            difficulty: _,
            hp: _,
            max_hp: _,
            pool,
            last_attacker: _,
            is_alive: _,
            attack_cost: _,
            death_time: _,
        } = boss;
        
        // 如果奖池里还有钱，退回给管理员
        let amount = balance::value(&pool);
        if (amount > 0) {
            let reward_coin = coin::from_balance(pool, ctx);
            transfer::public_transfer(reward_coin, tx_context::sender(ctx));
        } else {
            balance::destroy_zero(pool);
        };
        object::delete(id);
    }
}
