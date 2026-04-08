function updateSliderFill(slider) {
  if (!slider) return;
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 100;
  const value = parseFloat(slider.value) || 0;
  const pct = ((value - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(90deg,#b388ff ${pct}%,rgba(100,70,200,.2) ${pct}%)`;
}

function createBadgeAnimator(badge, formatter) {
  let animationId = null;
  let currentValue = 0;

  return {
    setInitial(value) {
      currentValue = parseInt(value, 10) || 0;
      if (badge) badge.textContent = formatter(currentValue);
    },
    animate(to, duration = 200) {
      if (!badge) return;
      const from = currentValue;
      if (animationId) cancelAnimationFrame(animationId);
      let startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(from + (to - from) * eased);
        badge.textContent = formatter(value);
        if (progress < 1) animationId = requestAnimationFrame(step);
      }

      animationId = requestAnimationFrame(step);
      currentValue = to;
    },
  };
}

function bindLinkedSlider({ slider, input, badge, formatter, onChange, onHintChange, onDynamicHintChange }) {
  if (!slider || !input) return;
  const animator = createBadgeAnimator(badge, formatter);
  animator.setInitial(input.value);

  const sync = (source) => {
    const value = parseInt(source.value, 10) || 0;
    slider.value = String(value);
    input.value = String(value);
    animator.animate(value);
    updateSliderFill(slider);
    onHintChange?.();
    onDynamicHintChange?.(value);
    onChange?.();
  };

  slider.addEventListener('input', () => sync(slider));
  input.addEventListener('input', () => sync(input));
  updateSliderFill(slider);
}

export function createFinanceSliderController({ dom }) {
  let onChange = null;
  let onHintChange = null;
  let onDynamicHintChange = null;

  function syncHints() {
    onHintChange?.();
    onDynamicHintChange?.(parseInt(dom.dynamicInput?.value || '0', 10) || 0);
  }

  function bind({ onInputChange, updateYearsHint, updateDynamicHint }) {
    onChange = onInputChange;
    onHintChange = updateYearsHint;
    onDynamicHintChange = updateDynamicHint;

    bindLinkedSlider({
      slider: dom.ageNowSlider,
      input: dom.ageNowInput,
      badge: dom.ageNowBadge,
      formatter: (value) => `${value} Jahre`,
      onChange,
      onHintChange,
      onDynamicHintChange: () => {},
    });

    bindLinkedSlider({
      slider: dom.ageStartSlider,
      input: dom.ageStartInput,
      badge: dom.ageStartBadge,
      formatter: (value) => `${value} Jahre`,
      onChange,
      onHintChange,
      onDynamicHintChange: () => {},
    });

    bindLinkedSlider({
      slider: dom.monthlySlider,
      input: dom.monthlyInput,
      badge: dom.monthlyBadge,
      formatter: (value) => `${value} €`,
      onChange,
      onHintChange: () => {},
      onDynamicHintChange: () => {},
    });

    bindLinkedSlider({
      slider: dom.dynamicSlider,
      input: dom.dynamicInput,
      badge: dom.dynamicBadge,
      formatter: (value) => `${value} %`,
      onChange,
      onHintChange,
      onDynamicHintChange,
    });

    document.querySelectorAll('.slider').forEach(updateSliderFill);
    syncHints();
  }

  return {
    bind,
    refresh: () => {
      document.querySelectorAll('.slider').forEach(updateSliderFill);
      syncHints();
    },
  };
}
