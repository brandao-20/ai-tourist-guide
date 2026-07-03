// rollup.config.js
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import livereload from 'rollup-plugin-livereload';
import css from 'rollup-plugin-css-only';
import terser from '@rollup/plugin-terser';

const production = !process.env.ROLLUP_WATCH;

const plugins = [
  css({ output: '[name].css' }),
  resolve({
    browser: true
  }),
  commonjs(),
  !production && livereload('public'),
  production && terser()
];

export default [
  // Bundle para main.js (scripts compartilhados ou globais)
  {
    input: 'src/main.js',
    output: {
      file: 'public/build/main.js',
      format: 'iife',
      name: 'main',
      sourcemap: !production,
    },
    plugins: plugins,
  },
  // Bundle para home_logged.js
  {
    input: 'src/home_logged.js',
    output: {
      file: 'public/build/home_logged.js',
      format: 'iife',
      name: 'home_logged',
      sourcemap: !production,
    },
    plugins: plugins,
  },
  // Bundle para login.js
  {
    input: 'src/login.js',
    output: {
      file: 'public/build/login.js',
      format: 'iife',
      name: 'login',
      sourcemap: !production,
    },
    plugins: plugins,
  },
  // Bundle para register.js
  {
    input: 'src/register.js',
    output: {
      file: 'public/build/register.js',
      format: 'iife',
      name: 'register',
      sourcemap: !production,
    },
    plugins: plugins,
  },
  // Bundle para profile.js
  {
    input: 'src/profile.js',
    output: {
      file: 'public/build/profile.js',
      format: 'iife',
      name: 'profile',
      sourcemap: !production,
    },
    plugins: plugins,
  },
  // Bundle para edit_profile.js
  {
    input: 'src/edit_profile.js',
    output: {
      file: 'public/build/edit_profile.js',
      format: 'iife',
      name: 'edit_profile',
      sourcemap: !production,
    },
    plugins: plugins,
  },
  // Bundle para mainapp.js (novo ponto de entrada)
  {
    input: 'src/mainapp.js',
    output: {
      file: 'public/build/mainapp.js',
      format: 'iife',
      name: 'mainapp',
      sourcemap: !production,
    },
    plugins: plugins,
  },
  // Bundle para mainapp.js (novo ponto de entrada)
  {
    input: 'src/route_details.js',
    output: {
      file: 'public/build/route_details.js',
      format: 'iife',
      name: 'route_details',
      sourcemap: !production,
    },
    plugins: plugins,
  },
];
