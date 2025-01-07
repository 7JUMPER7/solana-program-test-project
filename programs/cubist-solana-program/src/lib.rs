use anchor_lang::{prelude::*, solana_program::system_program};

declare_id!("9HCQ6AHFBWWDSz82oThQN6P6dNNrvWFqyEpMhq6gXo3a");

#[program]
pub mod my_solana_program {
    use super::*;

    /// Инициализация аккаунта, где будет храниться список взаимодействий.
    /// Вызывается один раз при деплое или при создании PDA-аккаунта.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let interactions_account = &mut ctx.accounts.interactions_account;
        interactions_account.authority = *ctx.accounts.authority.key;
        interactions_account.interactions = vec![];
        Ok(())
    }

    /// Сохраняет в список (InteractionsAccount) адрес кошелька,
    /// который вызвал функцию, и дату взаимодействия (в секундах).
    pub fn store_interaction(ctx: Context<StoreInteraction>) -> Result<()> {
        let interactions_account = &mut ctx.accounts.interactions_account;
        let clock = Clock::get()?;

        // Проверим, что только владелец (authority) может записывать
        // в этот аккаунт (необязательно, зависит от вашей логики)
        require_keys_eq!(
            interactions_account.authority,
            ctx.accounts.authority.key(),
            MyError::InvalidAuthority
        );

        // Добавляем новую запись (адрес вызывающего + дата)
        interactions_account.interactions.push(Interaction {
            wallet_address: ctx.accounts.authority.key(),
            last_interaction_timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    /// Пустая инструкция, которую не всегда используют в Anchor,
    /// так как обычно чтение происходит на клиенте методом getAccount.
    /// Но если нужно вернуть какие-то данные прямо из инструкции —
    /// можно использовать события (emit!) или сериализовать результат.
    /// Здесь просто показываем пример, что можно вызывать read-инструкцию.
    pub fn read_interactions(_ctx: Context<ReadInteractions>) -> Result<()> {
        // Ничего не делаем — чтение произойдёт на клиентской стороне через getAccount.
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// Аккаунт, где будут храниться записи взаимодействий
    #[account(
        init,
        payer = authority,
        space = 8 + InteractionAccount::MAX_SIZE,
        seeds = [b"interactions".as_ref(), authority.key().as_ref()],
        bump
    )]
    pub interactions_account: Account<'info, InteractionAccount>,

    /// Кто оплачивает создание аккаунта (и является authority)
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Системная программа Solana
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StoreInteraction<'info> {
    /// С существующим PDA-аккаунтом, где хранится список взаимодействий
    #[account(
        mut,
        seeds = [b"interactions".as_ref(), authority.key().as_ref()],
        bump
    )]
    pub interactions_account: Account<'info, InteractionAccount>,

    /// Авторизованный кошелёк
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReadInteractions<'info> {
    /// Аккаунт со списком взаимодействий
    #[account(
        seeds = [b"interactions".as_ref(), authority.key().as_ref()],
        bump
    )]
    pub interactions_account: Account<'info, InteractionAccount>,

    pub authority: Signer<'info>,
}

/// Хранимая структура одного взаимодействия
#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct Interaction {
    pub wallet_address: Pubkey,
    pub last_interaction_timestamp: i64,
}

/// Главная структура аккаунта (PDA), в которой будет храниться список
#[account]
pub struct InteractionAccount {
    // Владелец аккаунта (кто может писать)
    pub authority: Pubkey,
    // Список взаимодействий
    pub interactions: Vec<Interaction>,
}

impl InteractionAccount {
    // Примерно оценим максимальный размер аккаунта.
    // Здесь 32 байта под authority + 4 байта под длину вектора +
    // вектор, где каждый Interaction = (32 + 8) байт = 40 байт.
    // Для демо установим какой-то запас (например, 1000 взаимодействий).
    pub const MAX_INTERACTIONS: usize = 10;
    pub const MAX_SIZE: usize = 32 +         // authority
        4 +          // длина вектора (u32)
        Self::MAX_INTERACTIONS * (32 + 8); // Interaction
}

/// Пример своих ошибок
#[error_code]
pub enum MyError {
    #[msg("Invalid authority")]
    InvalidAuthority,
}
