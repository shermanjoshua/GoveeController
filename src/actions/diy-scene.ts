import streamDeck, { action, Action, DidReceiveSettingsEvent, KeyDownEvent, SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";

import { goveeClient } from "../govee/client";
import { DataSourceRequest, DataSourceResponse, trySendDevices } from "../ui";

const GET_SCENES_EVENT = "getScenes";

/**
 * Sets the diy scene of a device.
 */
@action({ UUID: "com.geekyeggo.goveecontroller.diy-scene" })
export class DIYScene extends SingletonAction<DIYSceneSettings> {
	/** @inheritdoc */
	public async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DIYSceneSettings>): Promise<void> {
		if (ev.payload.settings.deviceId) {
			await this.sendDiyScenes(ev.action, ev.payload.settings.deviceId);
		}
	}

	/** @inheritdoc */
	public async onKeyDown(ev: KeyDownEvent<DIYSceneSettings>): Promise<void> {
		try {
			// Ensure we have device identifier.
			const { deviceId, sceneId } = ev.payload.settings;
			if (deviceId === undefined) {
				throw new Error("No device selected.");
			}

			// Ensure we have a scene identifier.
			if (sceneId === undefined) {
				throw new Error("No scene selected.");
			}

			// Set the scene.
			const device = await goveeClient.getDeviceOrThrow(deviceId);
			await goveeClient.setDIYScene(device, sceneId);
			await ev.action.showOk();
		} catch (e) {
			ev.action.showAlert();
			streamDeck.logger.error("Failed to set DIY scene of device.", e);
		}
	}

	/** @inheritdoc */
	public async onSendToPlugin(ev: SendToPluginEvent<DataSourceRequest, DIYSceneSettings>): Promise<void> {
		if (ev.payload.event === GET_SCENES_EVENT) {
			if (ev.payload.isRefresh) {
				goveeClient.clearCache();
			}

			const { deviceId } = await ev.action.getSettings();
			await this.sendDiyScenes(ev.action, deviceId);
		} else {
			await trySendDevices(ev, {
				instance: "diyScene",
				type: "devices.capabilities.dynamic_scene"
			});
		}
	}

	/**
	 * Sends the DIY scenes associated with the {@link deviceId} to the property inspector.
	 * @param action DIY scene Stream Deck Action.
	 * @param deviceId Device identifier whose DIY scenes should be selected.
	 */
	private async sendDiyScenes(action: Action, deviceId: string | undefined): Promise<void> {
		if (deviceId === undefined) {
			return;
		}

		const getDIYScenes = async (): Promise<DataSourceResponse["items"]> => {
			try {
				const device = await goveeClient.getDeviceOrThrow(deviceId);
				const scenes = (await goveeClient.getDIYScenes(device))
					.sort((x, y) => x.name.localeCompare(y.name))
					.map((s) => {
						return {
							label: s.name,
							value: s.value.toString()
						};
					});

				return scenes.length > 0
					? scenes
					: [
							{
								disabled: true,
								value: "",
								label: "No scenes found"
							}
						];
			} catch (e) {
				action.showAlert();
				streamDeck.logger.error("Failed to load DIY scenes", e);

				return [
					{
						disabled: true,
						label: "Failed to load scenes",
						value: ""
					}
				];
			}
		};

		await action.sendToPropertyInspector({
			event: GET_SCENES_EVENT,
			items: await getDIYScenes()
		} satisfies DataSourceResponse);
	}
}

/**
 * Set DIY scene action.
 */
// type Action = WillAppearEvent<DIYSceneSettings>["action"];

/**
 * Settings for {@link DIYScene}.
 */
type DIYSceneSettings = {
	/**
	 * The device identifier.
	 */
	deviceId?: string;

	/**
	 * Light scene.
	 */
	sceneId?: number;
};
