document.querySelectorAll('.choice, .filter-option').forEach((control) => {
  control.addEventListener('click', () => {
    const group = control.closest('.choice-row, .filter-group');
    if (!group) return;
    group.querySelectorAll('[aria-pressed]').forEach((item) => item.setAttribute('aria-pressed', 'false'));
    control.setAttribute('aria-pressed', 'true');
  });
});

document.querySelectorAll('form').forEach((form) => {
  form.addEventListener('submit', (event) => event.preventDefault());
});
