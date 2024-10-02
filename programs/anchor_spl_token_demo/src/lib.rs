use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount};
use anchor_spl::token::{MintTo, Token, Transfer};

declare_id!("FPcitBxjEg9ujAUQ4AgiaMahBVHTYJK3suvoCGKzR5ra");

#[program]
pub mod anchor_spl_token_demo {
    use super::*;
    use mpl_token_metadata::{
        instructions::{
            CreateMetadataAccountV3Cpi, CreateMetadataAccountV3CpiAccounts,
            CreateMetadataAccountV3InstructionArgs,
        },
        types::{CollectionDetails, DataV2},
    };

    pub fn mint_token(ctx: Context<MintToken>, amount: u64) -> Result<()> {
        let ctx_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let binding = ctx.accounts.mint.to_account_info().key();
        let seeds = [
            b"metadata",
            mpl_token_metadata::ID.as_ref(),
            binding.as_ref(),
        ];

        let (metadata_pda, _bump) = Pubkey::find_program_address(&seeds, &mpl_token_metadata::ID);
        msg!("metadata_pda : {}", metadata_pda);
        msg!("mpl token metadata : {}", mpl_token_metadata::ID);
        msg!("binding: {}", binding);

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
        let metadata_data = CreateMetadataAccountV3InstructionArgs {
            data: DataV2 {
                name,
                symbol,
                uri,
                seller_fee_basis_points: 0,
                creators: None,
                collection: None,
                uses: None,
            },
            is_mutable: true,
            collection_details: Some(CollectionDetails::V1 { size: 0 }),
        };
        let ix = CreateMetadataAccountV3CpiAccounts {
            metadata: &ctx.accounts.metadata_account.to_account_info(),
            mint: &ctx.accounts.mint.to_account_info(),
            mint_authority: &ctx.accounts.payer.to_account_info(),
            update_authority: (&ctx.accounts.payer.to_account_info(), true),
            payer: &ctx.accounts.payer.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
            rent: None,
        };

        let binding = ctx.accounts.metadata_account.to_account_info();
        let metadata_account = CreateMetadataAccountV3Cpi::new(&binding, ix, metadata_data);

        metadata_account.invoke()?;
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
    /// CHECK:
    #[account(init , payer = payer , space = 8 + 100 ,seeds =[ b"metadata", mpl_token_metadata::ID.as_ref(), mint.key().as_ref()] , bump )]
    pub metadata_account: AccountInfo<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK:
    pub metadata_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
