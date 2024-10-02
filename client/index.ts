import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

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
let addressProgramId: PublicKey;
let userProfileProgramId: PublicKey;

class AddressAccount {
  address: Uint8Array = new Uint8Array([]);
  constructor(fields: { address: Uint8Array } | undefined = undefined) {
    if (fields) {
      this.address = fields.address;
    }
  }
}

const AddressSchema = new Map([
  [AddressAccount, { kind: "struct", fields: [["address", [512]]] }],
]);

const strToBuffer = (str: string, len: number) => {
  const buf = new Buffer(len);
  buf.write(str);
  return buf;
};

export async function estalishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();

  connection = new Connection(rpcUrl, "confirmed");
  const version = await connection.getVersion();
  console.log("conneted to cluster: ", rpcUrl, version);
}

export async function establisshPayer(): Promise<void> {
  let fees = 0;

  if (!payer) {
    const { feeCalculator } = await connection.getRecentBlockhash();
    fees += await connection.getMinimumBalanceForRentExemption(MAX_SIZE);

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

export async function checkProgram(): Promise<void> {
  program_id = new PublicKey(PARENT_CONTRACT_ID);
  addressContract = new PublicKey(ADDRESS_CONTRACT_ID);
  profileContract = new PublicKey(PROFILE_CONTRACT_ID);

  const programInfo = await connection.getAccountInfo(program_id);

  if (!programInfo) {
    throw new Error("program not found");
  } else if (programInfo.executable == false) {
    throw new Error("program is not executable");
  }

  console.log("using program ", program_id.toBase58());

  addressProgramId = PublicKey.findProgramAddressSync(
    [Buffer.from("address"), payer.publicKey.toBytes()],
    program_id
  )[0];
  userProfileProgramId = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), payer.publicKey.toBytes()],
    program_id
  )[0];
}

export async function initialize(): Promise<void> {
  const buffers = [Buffer.from(Int8Array.from([2]))];
  const data = Buffer.concat(buffers);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: userProfileProgramId, isSigner: false, isWritable: true },
      { pubkey: addressProgramId, isSigner: false, isWritable: true },
      { pubkey: profileContract, isSigner: false, isWritable: true },
      { pubkey: addressContract, isSigner: false, isWritable: true },
    ],
    programId: program_id,
    data: data,
  });

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer]
  );
}

export const updateAddress = async (address: string) => {
  const buffers = [Buffer.from(Int8Array.from(0)), strToBuffer(address, 512)];
  const data = Buffer.concat(buffers);
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: addressProgramId, isSigner: false, isWritable: true },
      { pubkey: addressContract, isSigner: false, isWritable: false },
    ],
    programId: program_id,
    data,
  });
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer]
  );
};

export const getAddress = async () => {
  const accountInfo = await connection.getAccountInfo(addressProgramId);

  const address = borsh.deserialize(
    AddressSchema,
    AddressAccount,
    accountInfo?.data
  );

  console.log(new TextDecoder().decode(address.address));
};

async function main() {
  await estalishConnection();
  await establisshPayer();
  await checkProgram();
  await initialize();
  await updateAddress("roorkee");
  await getAddress();
}

main();
