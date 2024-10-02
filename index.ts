import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { getKeypairFromFile } from "@solana-developers/helpers";
import * as borsh from "borsh";

const MAX_SIZE = 1000;

const PARENT_CONTRACT_ID = "";
const ADDRESS_CONTRACT_ID = "";
const PROFILE_CONTRACT_ID = "";

let connection: Connection;
let payer: Keypair;
let program_id: PublicKey;

let addressContract: PublicKey;
let profileContract: PublicKey;
let address_account_pda: PublicKey;
let user_profile_account_pda: PublicKey;

class AddressAccount {
  address: Uint8Array = new Uint8Array([]);
  constructor(fields: { address: Uint8Array } | undefined = undefined) {
    if (fields) {
      this.address = fields.address;
    }
  }
}

const AddressSchema: borsh.Schema = {
  struct: {
    address: {
      array: { type: "u8", len: 512 },
    },
  },
};

const AddressAccountSize = borsh.serialize(AddressSchema, {
  address: new Uint8Array(512),
}).length;

class UserProfileAccount {
  name: Uint8Array = new Uint8Array([]);
  date: number = 0;
  month: number = 0;
  year: number = 0;
  constructor(
    fields:
      | { name: Uint8Array; date: number; month: number; year: number }
      | undefined = undefined
  ) {
    if (fields) {
      this.name = fields.name;
      this.date = fields.date;
      this.month = fields.month;
      this.year = fields.year;
    }
  }
}

const UserProfileSchema: borsh.Schema = {
  struct: {
    name: { array: { type: "u8", len: 512 } },
    date: "i32",
    month: "i32",
    year: "i32",
  },
};

const UserProfileAccountSize = borsh.serialize(UserProfileSchema, {
  name: new Uint8Array(512),
  date: 1,
  month: 1,
  year: 1,
}).length;

const getPayer = async () => {
  return getKeypairFromFile("~/.config/solana/id.json");
};

const getRpcUrl = async () => {
  return "http://localhost:8899";
};

// const AddressSchema = { kind: "struct", fields: [["address", [512]]] };

// const UserProfileSchema = { kind: "struct", fields: [["name", [512]], ["date", "i32"], ["month", "i32"], ["year", "i32"]] };

const strToBuffer = (str: string, len: number): Buffer => {
  const buf = Buffer.alloc(len); // Safe buffer allocation with specified length
  buf.write(str, 0, len, "utf-8"); // Write the string to the buffer
  return buf;
};

export async function estalishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();

  connection = new Connection(rpcUrl, "confirmed");
  const version = await connection.getVersion();
  console.log("conneted to cluster: ", rpcUrl, version);
}

export async function establishPayer(): Promise<void> {
  let fees = 0;

  if (!payer) {
    const { feeCalculator } = await connection.getRecentBlockhash();
    fees += await connection.getMinimumBalanceForRentExemption(
      UserProfileAccountSize * 5 + AddressAccountSize * 5
    );

    fees += feeCalculator.lamportsPerSignature * 100;

    payer = await getPayer();
  }

  let lamports = await connection.getBalance(payer.publicKey);

  if (lamports < fees) {
    const sig = await connection.requestAirdrop(
      payer.publicKey,
      fees - lamports
    );

    await connection.confirmTransaction(sig);

    lamports = await connection.getBalance(payer.publicKey);
  }

  console.log(
    "Using account",
    payer.publicKey.toBase58(),
    "containing",
    lamports / LAMPORTS_PER_SOL,
    "SOL to pay for fees"
  );
}

export async function checkProgram_get_pda(): Promise<void> {
  program_id = (
    await getKeypairFromFile(
      "./ecomm_contract/target/deploy/ecomm_contract-keypair.json"
    )
  ).publicKey;
  addressContract = (
    await getKeypairFromFile(
      "./address_program/target/deploy/address_program-keypair.json"
    )
  ).publicKey;
  profileContract = (
    await getKeypairFromFile(
      "./profile_program/target/deploy/profile_program-keypair.json"
    )
  ).publicKey;

  const programInfo = await connection.getAccountInfo(program_id);

  if (!programInfo) {
    throw new Error("program not found");
  } else if (programInfo.executable == false) {
    throw new Error("program is not executable");
  }

  console.log("using program ", program_id.toBase58());

  address_account_pda = PublicKey.findProgramAddressSync(
    [Buffer.from("address"), payer.publicKey.toBytes()],
    program_id
  )[0];
  user_profile_account_pda = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), payer.publicKey.toBytes()],
    program_id
  )[0];
}

export async function initialize(): Promise<void> {
  console.log("initialize invoked");

  const data = Buffer.concat([Buffer.from([2])]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: user_profile_account_pda, isSigner: false, isWritable: true },
      { pubkey: address_account_pda, isSigner: false, isWritable: true },
      { pubkey: profileContract, isSigner: false, isWritable: true },
      { pubkey: addressContract, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: program_id,
    data: data,
  });

  const hash = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer]
  );

  console.log("initialize hash: ", hash);
}

export const updateAddress = async (address: string) => {
  const buffers = [Buffer.from([0]), strToBuffer(address, AddressAccountSize)];

  const data = Buffer.concat(buffers);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: address_account_pda, isSigner: false, isWritable: true },
      { pubkey: addressContract, isSigner: false, isWritable: false },
    ],
    programId: program_id,
    data,
  });

  // await sendAndConfirmTransaction(
  //   connection,
  //   new Transaction().add(instruction),
  //   [payer]
  // );
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer]
  );
};

export const hitAddressPdaAccountFromClient = async (address: string) => {
  const buffers = [strToBuffer(address, AddressAccountSize)];

  const data = Buffer.concat(buffers);

  const instruction = new TransactionInstruction({
    programId: addressContract,
    keys: [{ pubkey: address_account_pda, isSigner: false, isWritable: true }],
    data,
  });

  const hash = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer]
  );

  console.log("hash: ", hash);
};

export const updateProfile = async (
  profile: UserProfileAccount & { name: string }
) => {
  const profileData = {
    name: strToBuffer(profile.name as string, 512),
    date: profile.date,
    year: profile.year,
    month: profile.month,
  };

  const serializedData = borsh.serialize(UserProfileSchema, profileData);

  const buffers = [Buffer.from([1]), serializedData];

  const data = Buffer.concat(buffers);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: user_profile_account_pda, isSigner: false, isWritable: true },
      { pubkey: profileContract, isSigner: false, isWritable: false },
    ],
    programId: program_id,
    data,
  });
  const hash = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer]
  );
  console.log("updateProfile hash: ", hash);
};

export const getAddress = async () => {
  const accountInfo = await connection.getAccountInfo(address_account_pda);
  console.log("getAddress accountInfo: ", accountInfo);

  // if (accountInfo?.data) {
  //   const address = borsh.deserialize(AddressSchema, accountInfo?.data);
  //   console.log("address is: ", address);
  // }
};
export const getProfile = async () => {
  const accountInfo = await connection.getAccountInfo(user_profile_account_pda);
  console.log("getProfile accountInfo: ", accountInfo);
  // return
  // if (accountInfo?.data) {
  //   const address = borsh.deserialize(UserProfileSchema, accountInfo?.data);
  //   console.log("address is: ", address);
  // }
};

async function main() {
  await estalishConnection();
  await establishPayer();
  await checkProgram_get_pda();
  // await initialize();
  await hitAddressPdaAccountFromClient("ABCDE");
  // await updateAddress("roorkee");
  await getAddress();
  // @ts-ignore
  // await updateProfile({name:'samad',date:1, month:1,year:2000})
  // await getProfile()
}

main();
