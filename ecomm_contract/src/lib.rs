use borsh::{BorshDeserialize, BorshSerialize};

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    instruction::{AccountMeta, Instruction},
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar, // instruction::{Instruction,AccountMeta},
                    // program::invoke_signed,
                    // sysvar::{rent::Rent,Sysvar},
                    // system_instruction
};

#[derive(Clone, Debug, BorshDeserialize, BorshSerialize, PartialEq)]
pub enum InstructionData {
    UpdateAddress {
        address: [u8; 512],
    },
    UpdateUserInfo {
        name: [u8; 512],
        date: i32,
        month: i32,
        year: i32,
    },
    Initialize {},
}

#[derive(Clone, Debug, BorshDeserialize, BorshSerialize, PartialEq)]
pub struct AddressInstructionData {
    address: [u8; 512],
}

#[derive(Clone, Debug, BorshDeserialize, BorshSerialize, PartialEq)]
pub struct UserProfileInstructionData {
    name: [u8; 512],
    date: i32,
    month: i32,
    year: i32,
}

#[derive(Debug, BorshDeserialize, BorshSerialize)]
pub struct AddressSchema {
    address: [u8; 512],
}

entrypoint!(handle_entrypoint);

pub fn handle_entrypoint(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> entrypoint::ProgramResult {
    let instruction = InstructionData::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidAccountData)?;

    if accounts.is_empty() {
        msg!("Account must not be empty!");
        return Err(ProgramError::InvalidAccountData);
    }

    let accounts_iter = &mut accounts.iter();

    match instruction {
        InstructionData::Initialize {} => {
            msg!("Initialize PDAs");

            let account = next_account_info(accounts_iter)?;

            let update_user_profile_acount = next_account_info(accounts_iter)?;
            let update_address_account = next_account_info(accounts_iter)?;

            let update_user_profile_contract = next_account_info(accounts_iter)?;
            let update_address_contract = next_account_info(accounts_iter)?;

            let system_program = next_account_info(accounts_iter)?;

            let (found_address_account, address_bump) = get_address_pda(account, program_id);

            if found_address_account != *update_address_account.key {
                msg!("incorrect address PDA as input");
                msg!(&update_address_account.key.to_string());
                return Err(ProgramError::InvalidInstructionData);
            }
            
            msg!(
                "found_address_account: {}",
                &found_address_account.to_string()
            );

            let (found_profile_account, user_profile_bump) =
                get_user_profile_pda(account, program_id);

            if found_profile_account != *update_user_profile_acount.key {
                msg!("incorrect profile PDA as input");
                msg!(&update_user_profile_acount.key.to_string());
                return Err(ProgramError::InvalidInstructionData);
            }

            msg!(
                "found_profile_account: {}",
                &found_profile_account.to_string()
            );

            invoke_signed(
                &system_instruction::create_account(
                    account.key,
                    update_address_account.key,
                    Rent::get()?.minimum_balance(std::mem::size_of::<AddressSchema>()),
                    std::mem::size_of::<AddressSchema>().try_into().unwrap(),
                    update_address_contract.key,
                ),
                &[
                    update_address_account.clone(),
                    account.clone(),
                    system_program.clone(),
                ],
                &[&[b"address", account.key.as_ref(), &[address_bump]]],
            )?;

            invoke_signed(
                &system_instruction::create_account(
                    account.key,
                    update_user_profile_acount.key,
                    Rent::get()?.minimum_balance(std::mem::size_of::<AddressSchema>()),
                    std::mem::size_of::<AddressSchema>().try_into().unwrap(),
                    update_user_profile_contract.key,
                ),
                &[
                    update_user_profile_acount.clone(),
                    account.clone(),
                    system_program.clone(),
                ],
                &[&[b"profile", account.key.as_ref(), &[user_profile_bump]]],
            )?;
        }

        InstructionData::UpdateAddress { address } => {
            msg!("updating address");

            let account = next_account_info(accounts_iter)?;
            let update_address_account = next_account_info(accounts_iter)?;
            let update_address_contract = next_account_info(accounts_iter)?;

            let (found_address_acount, address_bump) = get_address_pda(account, program_id);

            if found_address_acount != *update_address_account.key {
                msg!("address pda nqe incoming prog id");
                return Err(ProgramError::InvalidInstructionData);
            }

            let mut acct_meta: Vec<AccountMeta> = Vec::new();

            acct_meta.push(AccountMeta {
                pubkey: *update_address_account.key,
                is_signer: true,
                is_writable: true,
            });

            let address_instruction_data = AddressInstructionData { address };

            let mut buffer: Vec<u8> = Vec::new();
            address_instruction_data.serialize(&mut buffer)?;

            let instruction = Instruction {
                program_id: *update_address_contract.key,
                accounts: acct_meta,
                data: buffer,
            };

            invoke_signed(
                &instruction,
                &[update_address_account.clone()],
                &[&[b"address", account.key.as_ref(), &[address_bump]]],
            )
            .map_err(|_| ProgramError::IncorrectProgramId)?;
        }

        InstructionData::UpdateUserInfo {
            name,
            date,
            month,
            year,
        } => {
            msg!("InstructionData::UpdateUserInfo()");

            let account = next_account_info(accounts_iter)?;

            let update_profile_account = next_account_info(accounts_iter)?;
            let update_profile_contract = next_account_info(accounts_iter)?;

            let (found_user_info_account, user_profile_bump) =
                get_user_profile_pda(account, program_id);

            // msg!("{} {} {} {}", name, date, month, year);

            if found_user_info_account != *update_profile_account.key {
                msg!("user pda nqe incoming prg id");
                return Err(ProgramError::InvalidAccountData);
            }
            let mut acct_meta: Vec<AccountMeta> = Vec::new();

            acct_meta.push(AccountMeta {
                pubkey: *update_profile_account.key,
                is_signer: true,
                is_writable: true,
            });

            let user_profile_instruction_data = UserProfileInstructionData { name,month,date,year };

            let mut buffer: Vec<u8> = Vec::new();
            user_profile_instruction_data.serialize(&mut buffer)?;

            let instruction = Instruction {
                program_id: *update_profile_contract.key,
                accounts: acct_meta,
                data: buffer,
            };

            invoke_signed(
                &instruction,
                &[update_profile_account.clone()],
                &[&[b"profile", account.key.as_ref(), &[user_profile_bump]]],
            )
            .map_err(|_| ProgramError::IncorrectProgramId)?;
        }
    }

    Ok(())
}

pub fn get_address_pda(account: &AccountInfo, program_id: &Pubkey) -> (Pubkey, u8) {
    return Pubkey::find_program_address(&[b"address", &account.key.to_bytes()[..32]], program_id);
}

pub fn get_user_profile_pda(account: &AccountInfo, program_id: &Pubkey) -> (Pubkey, u8) {
    return Pubkey::find_program_address(&[b"profile", &account.key.to_bytes()[..32]], program_id);
}