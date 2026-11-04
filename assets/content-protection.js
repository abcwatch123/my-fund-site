// Suppress image-specific menu actions inside protected media wrappers.
document.addEventListener('contextmenu', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-protected-media]')) {
    event.preventDefault();
  }
});
