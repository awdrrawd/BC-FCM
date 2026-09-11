let controller = {
    renderCurrent: () => {},
    refreshPanel: () => false,
    minimizePanel: () => {},
    closePanel: () => {},
    reopenForLang: () => {},
    getRenderToken: () => 0,
    notifyPanelChange: () => {},
};

function setPanelController(next) {
    controller = { ...controller, ...next };
}

const renderCurrent = (...args) => controller.renderCurrent(...args);
const refreshPanel = (...args) => controller.refreshPanel(...args);
const minimizePanel = (...args) => controller.minimizePanel(...args);
const closePanel = (...args) => controller.closePanel(...args);
const reopenForLang = (...args) => controller.reopenForLang(...args);
const getRenderToken = (...args) => controller.getRenderToken(...args);
const notifyPanelChange = (...args) => controller.notifyPanelChange(...args);

export { setPanelController, renderCurrent, refreshPanel, minimizePanel, closePanel, reopenForLang, getRenderToken, notifyPanelChange };
