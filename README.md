<div align=center>
  <img src=packages/ui/public/logo.svg height=144 width=144>
  <h1>UAAA</h1>
  <p>
    <font size=4>
      <b>U</b>nified
      <b>A</b>uthentication
      <b>A</b>nd
      <b>A</b>uthorization
    </font>
  </p>
  <p>
    <b>Sign into security</b>
  </p>
  <div>

[![docs](https://img.shields.io/badge/docs-available-1f88ff?style=flat-square)](https://uaaa.fedstack.org)
[![license](https://img.shields.io/github/license/fedstackjs/uaaa?style=flat-square)](https://github.com/fedstackjs/uaaa/blob/dev/LICENSE)

  </div>
</div>

## Build Images

```sh
TAG=latest
docker build . -f ./packages/server/Dockerfile -t git.pku.edu.cn/uaaa/server:"$TAG"
docker build . -f ./packages/ui/Dockerfile -t git.pku.edu.cn/uaaa/ui:"$TAG"
```

or using docker compose

```sh
export TAG=latest && docker compose build && docker compose push
```
