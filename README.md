# Crowned Bear animation test

A static WebGL 2 viewer for Crowned Bear · Life v3 A v2. Drag to orbit, scroll or pinch to zoom, or focus the model and use the arrow keys to orbit and I / W to switch clips. Switch between Idle (8 s) and Walk (1⅓ s), pause at any point, or reset the camera. Append `?clip=walk` to open directly on Walk. The viewer starts paused when the browser prefers reduced motion.

Run `python3 -m http.server 8000` in this directory and open `http://localhost:8000`. For GitHub Pages, publish the repository root. All assets are served from this directory. No build or package installation is needed.

The supplied GLB is unchanged. Its three embedded WebP images use `EXT_texture_webp`. Three.js r180 and the loader and orbit control modules are bundled under their [MIT license](vendor/three/LICENSE).
