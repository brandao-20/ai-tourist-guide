import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import livereload from 'rollup-plugin-livereload';
import css from 'rollup-plugin-css-only';
import terser from '@rollup/plugin-terser';

const production = !process.env.ROLLUP_WATCH;

// One entry per real HTML page that loads a compiled bundle from public/build/.
// Keep this list explicit so empty legacy files do not become public build output.
const pageEntries = [
  'home_logged',
  'login',
  'register',
  'profile',
  'edit_profile',
  'mainapp',
  'route_details',
  'status',
];

function createPlugins() {
  return [
    css({ output: '[name].css' }),
    resolve({ browser: true }),
    commonjs(),
    !production && livereload('public'),
    production && terser(),
  ].filter(Boolean);
}

function createPageBundle(entryName) {
  return {
    input: `src/${entryName}.js`,
    output: {
      file: `public/build/${entryName}.js`,
      format: 'iife',
      name: `${entryName}Page`,
      sourcemap: !production,
    },
    plugins: createPlugins(),
    watch: {
      clearScreen: false,
    },
  };
}

export default pageEntries.map(createPageBundle);
