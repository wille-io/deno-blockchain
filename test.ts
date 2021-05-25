import { Blockchain } from "./blockchain.ts"

const bc = new Blockchain("/home/wille/projects/deno-blockchain/");

bc.append(1234, new TextEncoder().encode("Test123!"));
console.log(new TextDecoder().decode(bc.getByIndex(0).data));
console.log(new TextDecoder().decode(bc.getById(1234).data));
console.log("count: " + bc.count());
