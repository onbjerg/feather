# Feather

> Latest version: *1.1.0*

Feather is a server-side caching solution for Aragon.

## Running

The API is exposed at port 3000.

```
docker run docker.pkg.github.com/onbjerg/feather/server
```

### Configuration

| Environment Variable | Description             					 | Default                                      |
|----------------------|-----------------------------------|----------------------------------------------|
| `IPFS_GATEWAY`         | The IPFS gateway to use         | `https://ipfs.eth.aragon.network/ipfs/`      |
| `ETH_NODE`             | The Ethereum node to connect to | `wss://mainnet.eth.aragon.network/ws`        |
| `ENS_REGISTRY_ADDRESS` |                                 | `0x314159265dd8dbb310642f98f50c066173c1259b` |

## Usage

Simply send a request to the API with the first path segment being the address of the organisation you want to cache.

If the organisation is already in the cache, then the response will include a `cache` key with the current state on the cache server, and a property called `hit` with a value of `false`.

If the organisation was not already in the cache, then the response will include an empty object in the `cache` key, and a property called `hit` with a value of `true`.
