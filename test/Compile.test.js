import path from 'path';
import webpack from 'webpack';
import memoryfs from 'memory-fs';

/**
 * Handle tests running on different FS's
 * normalize all paths in output relative to this repos root
 */
const PROJECT_ROOT = path.join(__dirname, "..");
const replaceRoot = p => path.normalize(p.replace(PROJECT_ROOT, "~"));
const replaceDepRoot = dep => ({
  ...dep,
  path: replaceRoot(dep.path)
});

describe("Test cache loader stats", () => {
  it("should write .cache-loader directory", (done) => {
    const compiler = webpack({
      context: __dirname,
      entry: path.join(__dirname, "__fixtures__", "entry_1.js"),
      output: {
        path: path.resolve(__dirname),
        filename: 'bundle.js',
      },
      module: {
        rules: [{
          test: /\.js$/,
          use: {
            loader: path.resolve(__dirname, '../src'),
            options: {
              read(key, callback) {
                expect(replaceRoot(key)).toMatchSnapshot();
                callback(new Error("no reading is done"));
              },
              write(key, {
                remainingRequest,
                dependencies,
                contextDependencies
              }, callback) {

                const data = {
                  remainingRequest: replaceRoot(remainingRequest),
                  dependencies: dependencies.map(replaceDepRoot),
                  contextDependencies: contextDependencies.map(replaceDepRoot),
                };

                expect({
                  key: replaceRoot(key),
                  data
                }).toMatchSnapshot();
                callback();
              }
            }
          }
        }]
      }
    });
  
    const fs = new memoryfs();
  
    compiler.outputFileSystem = fs;

    compiler.run((err, stats) => {
      console.log(stats.toString());

      if (err || stats.hasErrors()) {
        throw new Error("Compile failed");  
      }

      done();
    });
  });
});