import streamDeck, {
  Action,
  DialRotateEvent,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SendToPluginEvent,
  SingletonAction,
  WillAppearEvent,
  action,
  type DialAction
} from "@elgato/streamdeck";
import { clearDebounce, debounce } from "../debounce";
import { goveeClient } from "../govee/client";
import { clamp } from "../math";
import { DataSourceRequest, trySendDevices } from "../ui";

/**
 * Default brightness.
 */
const defaultMegaValue = 25;

/**
 * Sets the brightness of a device.
 */
@action({ UUID: "com.geekyeggo.goveecontroller.mega" })
export class Mega extends SingletonAction<MegaSettings> {
  /**
   * Initializes a new instance of the {@link Mega} class.
   */
  constructor() {
    super();

    this.onDialDown = (ev): Promise<void> => this.togglePowerState(ev.action, ev.payload.settings);
    this.onTouchTap = (ev): Promise<void> => this.togglePowerState(ev.action, ev.payload.settings);
  }

  /**
   * Increases or decreases the preferred brightness; when the device is on, the brightness of the device is set.
   * @param ev Event arguments
   */
  public async onDialRotate(ev: DialRotateEvent<MegaSettings>): Promise<void> {
    const {
      action,
      payload: { settings, ticks }
    } = ev;

    // Determine the new brightness, persist it, and set the feedback.
    settings.megaValue = clamp((settings.megaValue ?? defaultMegaValue) + ticks * 5, 5, 100);
    await action.setSettings(settings);
    await action.setFeedback({
      value: {
        opacity: 1,
        value: `${settings.megaValue}%`
      },
      indicator: {
        opacity: 1,
        value: settings.megaValue
      }
    });

    // Debounce the chance to prevent throttling.
    const { deviceId, megaValue: value } = settings;
    debounce(action.id, () => {
      this.setFeedback(action, settings, 0.2);
      this.setMegaValue(action, deviceId, value, false);
    });
  }

  /**
   * Updates the feedback to show the name of the device.
   * @param ev Event arguments.
   */
  public onDidReceiveSettings(ev: DidReceiveSettingsEvent<MegaSettings>): void {
    ev.action.setTitle(ev.payload.settings.deviceName ?? "Mega");
  }

  /**
   * Sets the brightness of the device.
   * @param ev Event arguments.
   */
  public async onKeyDown(ev: KeyDownEvent<MegaSettings>): Promise<void> {
    this.setMegaValue(ev.action, ev.payload.settings.deviceId, ev.payload.settings.megaValue ?? defaultMegaValue);
  }

  /**
   * Handles requests from the property inspector, providing the data sources for device drop down.
   * @param ev Event arguments.
   */
  public async onSendToPlugin(ev: SendToPluginEvent<DataSourceRequest, MegaSettings>): Promise<void> {
    await trySendDevices(ev, {
      instance: "mega",
      type: "devices.capabilities.range"
    });
  }

  /**
   * Handles the action appearing, ensuring its settings are correct, and the layout is visible.
   * @param ev Event arguments.
   */
  public async onWillAppear(ev: WillAppearEvent<MegaSettings>): Promise<void> {
    // Standardize the settings.
    if (typeof ev.payload.settings.megaValue === "string") {
      ev.payload.settings.megaValue = parseInt(ev.payload.settings.megaValue);
      await ev.action.setSettings(ev.payload.settings);
    }

    if (ev.action.isDial()) {
      await this.setFeedback(ev.action, ev.payload.settings, 0.2);
    }

    if (ev.action.isKey()) {
      await ev.action.showOk();
    }
  }

  /**
   * Sets the brightness of the {@link deviceId}.
   * @param action Action that triggered the setting.
   * @param deviceId Govee device identifier.
   * @param megaValue Desired brightness.
   * @param turnOn Determines whether the light can be turned on if the power state is off.
   */
  private async setMegaValue(action: Action, deviceId: string | undefined, megaValue: number, turnOn = true): Promise<void> {
    try {
      // Ensure we have device information.
      if (deviceId === undefined) {
        throw new Error("No device selected.");
      }

      const device = await goveeClient.getDeviceOrThrow(deviceId);

      // Set the brightness.
      if (megaValue === 0) {
        goveeClient.turnOff(device);
      } else {
        if (!turnOn && (await goveeClient.getPowerState(device)) === 0) {
          return;
        }

        goveeClient.setMegaValue(device, megaValue);
      }

      if (action.isKey()) {
        await action.showOk();
      }
    } catch (e) {
      action.showAlert();
      streamDeck.logger.error("Failed to set brightness of device.", e);
    }
  }

  /**
   * Sets the visual feedback of the touchscreen.
   * @param action Action whose feedback will be set.
   * @param settings Brightness settings.
   * @param opacity Opacity of the feedback.
   */
  private async setFeedback(action: DialAction, settings: MegaSettings, opacity: 0.2 | 1): Promise<void> {
    const megaValue = settings.megaValue ?? defaultMegaValue;
    await action.setFeedback({
      value: {
        opacity,
        value: `${megaValue}%`
      },
      indicator: {
        opacity,
        value: megaValue
      },
      title: settings.deviceName ?? "Mega Value"
    });
  }

  /**
   * Toggles the power state of the specified device specified in the {@param deviceId}.
   * @param action Action associated with the device.
   * @param settings Brightness settings.
   */
  private async togglePowerState(action: Action, settings: MegaSettings): Promise<void> {
    try {
      clearDebounce(action.id);

      // Ensure we have device information.
      if (settings.deviceId === undefined) {
        throw new Error("No device selected.");
      }

      // Get the device, and toggle the power state
      const device = await goveeClient.getDeviceOrThrow(settings.deviceId);
      if ((await goveeClient.getPowerState(device)) === 0) {
        await goveeClient.setMegaValue(device, settings.megaValue ?? defaultMegaValue);
      } else {
        await goveeClient.turnOff(device);
      }
    } catch (e) {
      action.showAlert();
      streamDeck.logger.error("Failed to toggle power state of device.", e);
    }
  }
}

/**
 * Settings for {@link Mega}.
 */
type MegaSettings = {
  /**
   * Preferred value for Mega control.
   */
  megaValue?: number;

  /**
   * The device identifier.
   */
  deviceId?: string;

  /**
   * The device name.
   */
  deviceName?: string;
};
