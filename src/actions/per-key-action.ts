/**
 * Per-key routing for Stream Deck actions.
 *
 * The SDK creates one `SingletonAction` instance per action type, so every
 * button of that type shares the same instance fields. `PerKeyAction`
 * keeps the singleton the SDK requires but forwards each event to a
 * handler owned by a single key (`ev.action.id`), so state, timers and
 * polling subscriptions are never shared between buttons.
 *
 * @author taylorithm <taylorithm@proton.me>
 * @copyright taylorithm
 * @license MIT
 */
import {
  SingletonAction,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";

/** The settings type the SDK uses when none is given (`JsonObject`). */
type JsonObject = NonNullable<WillAppearEvent["payload"]["settings"]>;

/**
 * Event handlers owned by a single key. Methods the action does not use
 * can be omitted.
 */
export interface KeyHandler<TSettings extends JsonObject> {
  onWillAppear?(ev: WillAppearEvent<TSettings>): Promise<void> | void;
  onDidReceiveSettings?(ev: DidReceiveSettingsEvent<TSettings>): Promise<void> | void;
  onKeyDown?(ev: KeyDownEvent<TSettings>): Promise<void> | void;
  onWillDisappear?(ev: WillDisappearEvent<TSettings>): Promise<void> | void;
}

/**
 * Singleton action that delegates every event to a per-key handler.
 *
 * Subclasses implement `createHandler`; the handler for a key is created
 * the first time the key is seen and dropped when it disappears.
 */
export abstract class PerKeyAction<
  TSettings extends JsonObject,
  THandler extends KeyHandler<TSettings>,
> extends SingletonAction<TSettings> {
  private readonly handlers = new Map<string, THandler>();

  /** Creates the handler that owns the key with the given action id. */
  protected abstract createHandler(id: string): THandler;

  /** Returns the live handler for a key, if any. */
  public getHandler(id: string): THandler | undefined {
    return this.handlers.get(id);
  }

  override async onWillAppear(ev: WillAppearEvent<TSettings>): Promise<void> {
    await this.handlerFor(ev.action.id).onWillAppear?.(ev);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TSettings>): Promise<void> {
    await this.handlerFor(ev.action.id).onDidReceiveSettings?.(ev);
  }

  override async onKeyDown(ev: KeyDownEvent<TSettings>): Promise<void> {
    await this.handlerFor(ev.action.id).onKeyDown?.(ev);
  }

  override onWillDisappear(ev: WillDisappearEvent<TSettings>): void {
    const handler = this.handlers.get(ev.action.id);
    if (!handler) return;
    this.handlers.delete(ev.action.id);
    void handler.onWillDisappear?.(ev);
  }

  private handlerFor(id: string): THandler {
    let handler = this.handlers.get(id);
    if (!handler) {
      handler = this.createHandler(id);
      this.handlers.set(id, handler);
    }
    return handler;
  }
}
