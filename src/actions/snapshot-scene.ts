import streamDeck, { action, DidReceiveSettingsEvent, KeyDownEvent, SendToPluginEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

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
				instance: "snapshotScene",
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

		const getSnapshotScenes = async (): Promise<DataSourceResponse["items"]> => {
			try {
				const device = await goveeClient.getDeviceOrThrow(deviceId);
				const scenes = (await goveeClient.getSnapshotScenes(device))
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

		await action.sendToPropertyInspector({
			event: GET_SCENES_EVENT,
			items: await getSnapshotScenes()
		} satisfies DataSourceResponse);
	}
}

/**
 * Set Snapshot scene action.
 */
type Action = WillAppearEvent<SnapshotSceneSettings>["action"];

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
