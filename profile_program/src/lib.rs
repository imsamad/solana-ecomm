use borsh::{BorshDeserialize, BorshSerialize};

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

#[derive(Clone, Debug, BorshDeserialize, BorshSerialize, PartialEq)]
pub struct InstructionData {
    name: [u8; 512],
    date:i32,
    month:i32,
    year:i32,
}

#[derive(BorshDeserialize, BorshSerialize, Debug)]
pub struct AddressSchema {
    address: [u8; 512],
}

entrypoint!(handle_entrypoint);


pub fn handle_entrypoint(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instructions: &[u8],
) -> ProgramResult {
    msg!("Profile program invoked");

    let instruction = InstructionData::try_from_slice(instructions)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    if accounts.is_empty() {
        msg!("Provide account!");
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let accounts_iter = &mut accounts.iter();

    let pda_account = next_account_info(accounts_iter)?;
    
    if pda_account.owner != program_id {
        msg!("Not authorised");
        return Err(ProgramError::IncorrectProgramId);
    }

    if !pda_account.is_signer {
        msg!("PDA account must be a signer!");
        // return Err(ProgramError::IncorrectProgramId);
    }
    
    let mut pda_account_data = InstructionData::try_from_slice(&pda_account.data.borrow())?;

    pda_account_data.name = instruction.name;
    pda_account_data.date = instruction.date;
    pda_account_data.year = instruction.year;
    pda_account_data.month = instruction.month;

    pda_account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;

    Ok(())
}
