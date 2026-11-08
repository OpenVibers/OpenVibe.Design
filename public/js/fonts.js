'use strict';
document.addEventListener('DOMContentLoaded', () => {
    const input = document.querySelector('[data-font-sample]');
    if (!input) return;
    const samples = [...document.querySelectorAll('.fo-sample,.fo-style p')];
    const original = samples.map(node => node.textContent);
    input.addEventListener('input', () => samples.forEach((node, index) => { node.textContent = input.value || original[index]; }));
});
