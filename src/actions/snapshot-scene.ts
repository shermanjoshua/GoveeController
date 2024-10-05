import streamDeck, { action, Action, DidReceiveSettingsEvent, KeyDownEvent, SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";

import { goveeClient } from "../govee/client";
import { DataSourceRequest, DataSourceResponse, trySendDevices } from "../ui";

const GET_SCENES_EVENT = "getScenes";

/**
 * Sets the snapshot scene of a device.
 */
@action({ UUID: "com.geekyeggo.goveecontroller.snapshot-scene" })
export class SnapshotScene extends SingletonAction<SnapshotSceneSettings> {
	/** @inheritdoc */
	public async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SnapshotSceneSettings>): Promise<void> {
		if (ev.payload.settings.deviceId) {
			await this.sendSnapshotScenes(ev.action, ev.payload.settings.deviceId);
		}
	}

	/** @inheritdoc */
	public async onKeyDown(ev: KeyDownEvent<SnapshotSceneSettings>): Promise<void> {
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
			await goveeClient.setSnapshotScene(device, sceneId);
			await ev.action.showOk();
		} catch (e) {
			ev.action.showAlert();
			streamDeck.logger.error("Failed to set Snapshot scene of device.", e);
		}
	}

	/** @inheritdoc */
	public async onSendToPlugin(ev: SendToPluginEvent<DataSourceRequest, SnapshotSceneSettings>): Promise<void> {
		if (ev.payload.event === GET_SCENES_EVENT) {
			if (ev.payload.isRefresh) {
				goveeClient.clearCache();
			}

			const { deviceId } = await ev.action.getSettings();
			await this.sendSnapshotScenes(ev.action, deviceId);
		} else {
			await trySendDevices(ev, {
				instance: "snapshot",
				type: "devices.capabilities.dynamic_scene"
			});
		}
	}

	/**
	 * Sends the snapshot scenes associated with the {@link deviceId} to the property inspector.
	 * @param action snapshot scene Stream Deck Action.
	 * @param deviceId Device identifier whose snapshot scenes should be selected.
	 */
	private async sendSnapshotScenes(action: Action, deviceId: string | undefined): Promise<void> {
		if (deviceId === undefined) {
			return;
		}

    // This function intentionally works differently than the other dynamic scenes.
    // Govee currently has no published API endpoint for retrieving snapshot scenes, so we have to use the device `capabilities`.
		const getSnapshotScenes = async (): Promise<DataSourceResponse["items"]> => {
			try {
				const device = await goveeClient.getDeviceOrThrow(deviceId);

        const scenes = device.capabilities
          .filter(c => c.instance === "snapshot" && c.type === "devices.capabilities.dynamic_scene")
          .flatMap(c => c.parameters.options);

        if (scenes.length > 0) {
          return scenes.map(s => ({
            value: s.value.toString(),
            label: s.name
          }));
          } else {
            return [
							{
								disabled: true,
								value: "",
								label: "No snapshots found..."
							}
						];
          }
			} catch (e) {
				action.showAlert();
				streamDeck.logger.error("Failed to load SnapshotScene scenes", e);

				return [
					{
						disabled: true,
						label: "Failed to load scenes",
						value: ""
					}
				];
			}
		};

		await streamDeck.ui.current?.sendToPropertyInspector({
			event: GET_SCENES_EVENT,
			items: await getSnapshotScenes()
		} satisfies DataSourceResponse);
	}
}

/**
 * Settings for {@link SnapshotScene}.
 */
type SnapshotSceneSettings = {
	/**
	 * The device identifier.
	 */
	deviceId?: string;

	/**
	 * Light scene.
	 */
	sceneId?: number;
};
