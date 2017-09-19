import * as webpack from 'webpack';
import * as path from 'path';

module.exports = {
    entry: path.resolve(__dirname, './src/browser/index.ts'),
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, './bin/browser')
    },
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: [".ts", ".js"]
    }
}