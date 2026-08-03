module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Compile `'worklet'` directives into real worklet factories in the built
  // output. Without this, `lib/` ships the raw directives and every worklet is
  // dead on arrival for anyone resolving `main`/`module` (node, jest) — the
  // board mounts but never responds to a gesture.
  //
  // Metro consumers resolve `react-native: src/index` and compile the source
  // with their own Babel, so they were always fine; this makes the published
  // JS match that behaviour instead of depending on it.
  plugins: ['react-native-worklets/plugin'],
};
