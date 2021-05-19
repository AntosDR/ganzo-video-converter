/*
 * Toasts module.
 */

const containerSelector = "div#toast-container";
const templateSelector = "div#toast-container>div.toast.template";

declare const bootstrap: {Toast:any}; 

/**
 * Shows given toast notification.
 * @param type The type of the toast notification.
 * @param title The title of the notification.
 * @param message The message to show in the body.
 */
export default function showToast(type: 'info' | 'warning' | 'error', title: string, message: string) {
	bootstrap.Toast.Default.delay = 5000;
	const toastDom = $(templateSelector).clone();
	toastDom.removeClass("template");
	switch (type) {
		case "info":
			$("i.bi", toastDom).addClass("bi-info-circle");
			$('.toast-header', toastDom).addClass("bg-primary");
			break;
		case "warning":
			$("i.bi", toastDom).addClass("bi-exclamation-circle");
			$('.toast-header', toastDom).addClass("bg-warning");
			break;
		case "error":
			$("i.bi", toastDom).addClass("bi-x-circle");
			$('.toast-header', toastDom).addClass("bg-danger");
			break;
	}
	$("strong.toast-title", toastDom).text(title);
	$("div.toast-body", toastDom).text(message);

	$(containerSelector).append(toastDom);

	(toastDom as any).toast('show').on("hidden.bs.toast", () => toastDom.remove());
}

export type showToastFunc = typeof showToast;
