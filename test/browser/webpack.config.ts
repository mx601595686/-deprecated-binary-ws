import * as webpack from 'webpack';
import * as path from 'path';

module.exports = {
    entry: path.resolve(__dirname, './bin/browser/index.js'),
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, './bin/browser')
    }
}