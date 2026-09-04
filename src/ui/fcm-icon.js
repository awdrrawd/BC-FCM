import FCM_ICON_SVG from '../../assets/icons/fcm.svg?raw';

let fcmIconImage = null;

function preloadFcmIcon() {
    const blob = new Blob([FCM_ICON_SVG], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const releaseUrl = () => URL.revokeObjectURL(url);
    image.onload = () => { fcmIconImage = image; releaseUrl(); };
    image.onerror = releaseUrl;
    image.src = url;
}

preloadFcmIcon();

export { FCM_ICON_SVG, fcmIconImage };
