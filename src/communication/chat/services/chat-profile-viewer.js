function createChatProfileViewer({ findLiveCharacter, loadProfile, loadCharacter, showInformationSheet, warn }) {
    async function open(memberNumber, sharedProfile = null) {
        const target = Number(memberNumber);
        if (!target) return false;
        const live = !sharedProfile && findLiveCharacter(target);
        if (live) {
            showInformationSheet?.(live);
            return true;
        }
        try {
            const profile = sharedProfile || await loadProfile(target);
            if (!profile?.characterBundle) return false;
            const loaded = loadCharacter(JSON.parse(profile.characterBundle), target);
            if (!loaded) return false;
            showInformationSheet?.(loaded);
            return true;
        } catch (error) {
            warn(`saved chat profile open failed (${target})`, error);
            return false;
        }
    }

    return { open };
}

export { createChatProfileViewer };
