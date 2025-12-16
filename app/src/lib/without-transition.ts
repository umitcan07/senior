let timeoutAction: ReturnType<typeof setTimeout> | undefined;
let timeoutEnable: ReturnType<typeof setTimeout> | undefined;

export function withoutTransition(action: () => void) {
	clearTimeout(timeoutAction);
	clearTimeout(timeoutEnable);

	const style = document.createElement("style");
	const css = document.createTextNode(`* {
     -webkit-transition: none !important;
     -moz-transition: none !important;
     -o-transition: none !important;
     -ms-transition: none !important;
     transition: none !important;
  }`);
	style.appendChild(css);

	const disable = () => document.head.appendChild(style);
	const enable = () => document.head.removeChild(style);

	if (typeof window.getComputedStyle !== "undefined") {
		disable();
		action();
		window.getComputedStyle(style).opacity;
		enable();
		return;
	}

	if (typeof window.requestAnimationFrame !== "undefined") {
		disable();
		action();
		window.requestAnimationFrame(enable);
		return;
	}

	disable();
	timeoutAction = setTimeout(() => {
		action();
		timeoutEnable = setTimeout(enable, 120);
	}, 120);
}
