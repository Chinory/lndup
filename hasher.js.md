# hasher.js

Prototype of lndup's multi-processs hasher. It can also be used standalong.

- Output like `shasum`
- Only SHA-1 supported now

## Usage

- pipe paths to it, one line a path:

```shell
$ ls | ./hasher.js
6333c89d12d68d1284d2e22f4a0e4f7232a37d77  hasher.js
732c893b5a6f0d374a26446f35b8fee2f388305e  lndup.js
```

- An empty line means to close input. Started works will continue to complete.

## More

The master process use `--hasher` options to spawn worker process. A big difference is that worker process outputs **raw hash data**, such as a 20-bytes SHA-1.

## License

- GPL v3.0