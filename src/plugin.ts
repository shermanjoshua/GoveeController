import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { Brightness, Color, ColorTemperature, DIYScene, LightScene, SnapshotScene, TurnOnOff } from "./actions/";

console.log("Starting plugin...");

streamDeck.logger.setLevel(LogLevel.DEBUG);
// Register the actions and connect to Stream Deck.
streamDeck.actions.registerAction(new Brightness());
streamDeck.actions.registerAction(new Color());
streamDeck.actions.registerAction(new ColorTemperature());
streamDeck.actions.registerAction(new TurnOnOff());
streamDeck.actions.registerAction(new LightScene());
streamDeck.actions.registerAction(new DIYScene());
streamDeck.actions.registerAction(new SnapshotScene());
streamDeck.connect();
