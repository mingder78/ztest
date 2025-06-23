# ztest

To install dependencies:

```bash
bun install
```

To run:

```bash
😋➜ bun run create-account.ts
Predicted Account Address: 0xf244D7d836E232E6CF337070be635245E6a67Da0
Account creation tx hash: 0x35340ee2922949553ce524ac4aeddec29e2542dc04037b78de1c61989a355915
```

This project was created using `bun init` in bun v1.2.16. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.


## Todo

```
bun run dev:uo
$ bun run send-userop.ts
 6 |  * @returns The size of the value (in bytes).
 7 |  */
 8 | export function size(value) {
 9 |     if (isHex(value, { strict: false }))
10 |         return Math.ceil((value.length - 2) / 2);
11 |     return value.length;
                ^
TypeError: undefined is not an object (evaluating 'value.length')
```
