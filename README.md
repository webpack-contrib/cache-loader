[![npm][npm]][npm-url]
[![node][node]][node-url]
[![deps][deps]][deps-url]
[![test][test]][test-url]
[![coverage][cover]][cover-url]
[![chat][chat]][chat-url]

<div align="center">
  <a href="https://webpack.js.org/">
    <img width="200" height="200" src="https://cdn.rawgit.com/webpack/media/e7485eb2/logo/icon-square-big.svg">
  </a>
  <h1>Cache Loader</h1>
  <p>Caches the result of following loaders on disk</p>
</div>

<h2 align="center">Install</h2>

```bash
npm install --save-dev cache-loader
```

<h2 align="center">Usage</h2>

Add this loader in front of other (expensive) loaders to cache the result on disk.

**webpack.config.js**
```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.ext$/,
        use: [
          'cache-loader',
          ...loaders
        ],
        include: path.resolve('src')
      }
    ]
  }
}
```

> ⚠️ Note that there is an overhead for saving the reading and saving the cache file, so only use this loader to cache expensive loaders.

The loader checks timestamp values of all dependencies of the cached modules. Only if modification timestamp hasn't changed the cached result is used.

<h2 align="center">Options</h2>

|Name|Type|Default|Description|
|:--:|:--:|:-----:|:----------|
|**`cacheDirectory`**|`{String}`|`path.resolve('.cache-loader')`|Provide a cache directory where cache items should be stored|
|**`cacheIdentifier`**|`{String}`|`cache-loader:{version} {process.env.NODE_ENV}`|Provide an invalidation identifier which is used to generate the hashes. You can use it for extra dependencies of loaders.|
|**`overrideDependencies`**|`{Array<String>}`|none|Provide different dependencies for the modules. This override the default dependencies.|

<h2 align="center">Examples</h2>

**webpack.config.js**
```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          'cache-loader',
          'babel-loader'
        ],
        include: path.resolve('src')
      }
    ]
  }
}
```

### `Options`

**webpack.config.js**
```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: 'cache-loader',
            options: {
              cacheDirectory: path.resolve('.cache')
            }
          },
          'babel-loader'
        ],
        include: path.resolve('src')
      }
    ]
  }
}
```

<h2 align="center">Hints</h2>

For extra performance you could override the dependencies of modules for rarly changing modules:

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: 'cache-loader',
            options: {
              overrideDependencies: [path.resolve('yarn.lock')]
            }
          }
        ],
        include: path.resolve('node_modules')
      }
    ]
  }
}
```

With this config timestamps from files are no longer checked. Instead only the timestamp of the yarn lockfile is checked, which should be ok for normal yarn usage.

<h2 align="center">Maintainers</h2>

<table>
  <tbody>
    <tr>
      <td align="center">
        <a href="https://github.com/sokra">
          <img width="150" height="150" src="https://github.com/sokra.png?size=150">
          </br>
          Tobias Koppers
        </a>
      </td>
      <td align="center">
        <a href="https://github.com/bebraw">
          <img width="150" height="150" src="https://github.com/bebraw.png?v=3&s=150">
          </br>
          Juho Vepsäläinen
        </a>
      </td>
      <td align="center">
        <a href="https://github.com/d3viant0ne">
          <img width="150" height="150" src="https://github.com/d3viant0ne.png?v=3&s=150">
          </br>
          Joshua Wiens
        </a>
      </td>
      <td align="center">
        <a href="https://github.com/sapegin">
          <img width="150" height="150" src="https://github.com/sapegin.png?v=3&s=150">
          </br>
          Artem Sapegin
        </a>
      </td>
      <td align="center">
        <a href="https://github.com/michael-ciniawsky">
          <img width="150" height="150" src="https://github.com/michael-ciniawsky.png?v=3&s=150">
          </br>
          Michael Ciniawsky
        </a>
      </td>
      <td align="center">
        <a href="https://github.com/evilebottnawi">
          <img width="150" height="150" src="https://github.com/evilebottnawi.png?v=3&s=150">
          </br>
          Alexander Krasnoyarov
        </a>
      </td>
    </tr>
  <tbody>
</table>


[npm]: https://img.shields.io/npm/v/cache-loader.svg
[npm-url]: https://npmjs.com/package/cache-loader

[node]: https://img.shields.io/node/v/cache-loader.svg
[node-url]: https://nodejs.org

[deps]: https://david-dm.org/webpack-contrib/cache-loader.svg
[deps-url]: https://david-dm.org/webpack-contrib/cache-loader

[chat]: https://img.shields.io/badge/gitter-webpack%2Fwebpack-brightgreen.svg
[chat-url]: https://gitter.im/webpack/webpack

[test]: http://img.shields.io/travis/webpack-contrib/cache-loader.svg
[test-url]: https://travis-ci.org/webpack-contrib/cache-loader

[cover]: https://codecov.io/gh/webpack-contrib/cache-loader/branch/master/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack-contrib/cache-loader
