import path from 'path';
import webpack from 'webpack';
import memoryfs from 'memory-fs';

/**
 * Handle tests running on different FS's
 * normalize all paths in output relative to this repos root
 */
const PROJECT_ROOT = path.join(__dirname, "..");
const replaceRoot = p => path.normalize(p.replace(PROJECT_ROOT, "~"));
const replaceDataRoots = data => ({
  ...data,
  remainingRequest: replaceRoot(data.remainingRequest)
})

describe("Test cache loader stats", () => {
  let counterKey;

  beforeEach(() => {
    counterKey = 1;
  });
  it("should write loader files correctly", (done) => {
    const compiler = webpack({
      mode: "development",
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
              cacheDirectory: "/",
              cacheKey() {
                return String(counterKey++)
              },
              read(key, callback) {
                expect(replaceRoot(key)).toMatchSnapshot();
                callback(new Error("no reading is done"));
              },
              generate(depFileName, callback) {
                const data = replaceRoot(depFileName);
                expect(data).toMatchSnapshot();
                callback(null, data);
              },
              write(key, data, callback) {

                expect({
                  key,
                  data: replaceDataRoots(data)
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
