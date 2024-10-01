use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount};
use anchor_spl::token::{MintTo, Token, Transfer};
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("FGYiFLZcpMFTpj6fcFufHRNUnxU8jFUJo4XE213YRWok");

#[program]
pub mod anchor_spl_token_demo {

    use metaplex_token_metadata::instruction::create_metadata_accounts;
    use solana_program::program::invoke;

    use super::*;

    pub fn mint_token(ctx: Context<MintToken>, amount: u64) -> Result<()> {
        let ctx_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, ctx_accounts);
        token::mint_to(cpi_ctx, amount)?;
        Ok(())
    }

    pub fn transfer_token(ctx: Context<TransferToken>, amount: u64) -> Result<()> {
        let ctx_accounts = Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, ctx_accounts);
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }

    pub fn create_token_with_metadata(
        ctx: Context<CreateTokenWithMetadata>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        let metadata_instruction = create_metadata_accounts(
            ctx.accounts.metadata_program.key(),
            ctx.accounts.metadata_account.key(),
            ctx.accounts.mint.key(),
            ctx.accounts.mint_authority.key(),
            ctx.accounts.payer.key(),
            ctx.accounts.mint_authority.key(),
            name,
            symbol,
            uri,
            None,
            0,
            true,
            false,
        );
        invoke(
            &metadata_instruction,
            &[
                ctx.accounts.metadata_account.to_account_info(),
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.mint_authority.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintToken<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferToken<'info> {
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,

    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreateTokenWithMetadata<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK:  Metadata account
    #[account(mut)]
    pub metadata_account: UncheckedAccount<'info>,
    #[account(mut)]
    pub mint_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    /// CHECK: Metaplex Metadata program
    #[account(address = metaplex_token_metadata::id())]
    pub metadata_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// 91eRzoSpZuXQnjhoAecsHjqC2Wf1Ln7zm3LikCRiUHeU - mintkey
