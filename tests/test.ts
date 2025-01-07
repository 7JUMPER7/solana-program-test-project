import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, Connection, clusterApiUrl, Transaction, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import { MySolanaProgram } from "../target/types/my_solana_program";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

// Путь к вашему кошельку (JSON-файл с приватным ключом)
const WALLET_PATH = "";

async function main() {
    // 1. Импортируем кошелёк из JSON файла
    const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"))));

    console.log("Imported Wallet Address:", walletKeypair.publicKey.toBase58());

    // 2. Настраиваем провайдер с использованием импортированного кошелька
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const wallet = new anchor.Wallet(walletKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider);

    // 3. Инициализируем объект программы
    const program = new anchor.Program<MySolanaProgram>(
        require("../target/idl/my_solana_program.json"), // Замените на ваш реальный IDL
        provider
    );
    console.log("Program ID:", program.programId.toString());
    // const program = anchor.workspace.MySolanaProgram as anchor.Program<MySolanaProgram>;

    // 4. Создаём PDA аккаунта
    const [interactionsPda, bump] = await PublicKey.findProgramAddress(
        [Buffer.from("interactions"), walletKeypair.publicKey.toBuffer()],
        program.programId
    );

    console.log("PDA Address:", interactionsPda.toBase58());

    // // -------------------------------------------
    // // ВЫЗОВ 1: ИНИЦИАЛИЗАЦИЯ
    // // -------------------------------------------
    // try {
    //     const txSig = await program.methods
    //         .initialize()
    //         .accounts({
    //             interactionsAccount: interactionsPda,
    //             authority: walletKeypair.publicKey,
    //             systemProgram: anchor.web3.SystemProgram.programId,
    //         } as any)
    //         .signers([walletKeypair])
    //         .rpc();

    //     console.log("Initialize txSig:", txSig);
    // } catch (err) {
    //     console.error("Error during initialize:", err);
    // }

    // // -------------------------------------------
    // // ВЫЗОВ 2: ДОБАВЛЕНИЕ ВЗАИМОДЕЙСТВИЯ
    // // -------------------------------------------
    // try {
    //     const txSig = await program.methods
    //         .storeInteraction()
    //         .accounts({
    //             interactionsAccount: interactionsPda,
    //             authority: walletKeypair.publicKey,
    //         } as any)
    //         .signers([walletKeypair])
    //         .rpc();

    //     console.log("StoreInteraction txSig:", txSig);
    // } catch (err) {
    //     console.error("Error during storeInteraction:", err);
    // }

    // // -------------------------------------------
    // // ЧТЕНИЕ ДАННЫХ
    // // -------------------------------------------
    // try {
    //     const accountData = await program.account.interactionAccount.fetch(interactionsPda);
    //     console.log(
    //         "Interaction Account Data:",
    //         accountData.authority.toString(),
    //         accountData.interactions.map((i) => new Date(Number(i.lastInteractionTimestamp) * 1000))
    //     );
    // } catch (err) {
    //     console.error("Error reading interactions:", err);
    // }

    // TEST
    const info = await connection.getAccountInfo(program.programId);
    console.log(info.data.length);
    const rentInfo = await connection.getMinimumBalanceForRentExemption(info.data.length);
    console.log(rentInfo);
}

const OLD_WALLET_PATH = "";

async function transfer() {
    // const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(OLD_WALLET_PATH, "utf-8"))));
    const walletKeypair = Keypair.fromSecretKey(
        new Uint8Array(
            bs58.decode("")
        )
    );
    console.log(walletKeypair.publicKey.toString());

    const destAddress = new PublicKey("GgrjTTDnF4aYcDXb1NTScGq7DE4E9BAfKCnAtJHrkHpX");
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    const balance = await connection.getBalance(walletKeypair.publicKey);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const fee = await connection.getFeeForMessage(
        new Transaction({ recentBlockhash: blockhash, feePayer: walletKeypair.publicKey })
            .add(
                SystemProgram.transfer({
                    fromPubkey: walletKeypair.publicKey,
                    toPubkey: destAddress,
                    lamports: balance,
                })
            )
            .compileMessage()
    );

    if (balance <= fee.value) {
        console.error("Not enough SOL to cover the fees");
        return;
    }
    const amountToSend = balance - fee.value;
    console.log("Amount to send & fee:", amountToSend, fee.value);

    const transaction = new Transaction();
    transaction.add(
        SystemProgram.transfer({
            fromPubkey: walletKeypair.publicKey,
            toPubkey: destAddress,
            lamports: amountToSend,
        })
    );
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletKeypair.publicKey;
    transaction.sign(walletKeypair);

    const txId = await connection.sendRawTransaction(transaction.serialize());
    console.log(`TxID: ${txId}`);

    await connection.confirmTransaction(txId);
    console.log("Tx was confirmed.");
}

// main().catch((err) => console.error(err));
transfer().catch((err) => console.error(err));
