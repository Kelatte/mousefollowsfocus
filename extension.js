import Clutter from "gi://Clutter";
import Meta from "gi://Meta";
import { overview } from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import Effect from './effect.js';

let DEBUGGING = false;

let EXT_NAME = "unknown_extension";

export default class MouseFollowsFocus extends Extension {
    constructor(metadata) {
        super(metadata);
        EXT_NAME = metadata.name;
    }

    enable() {
        dbg_log(`enabling ${EXT_NAME}`);
        // _effect = new Effect();

        for (const actor of global.get_window_actors()) {
            if (actor.is_destroyed()) {
                continue;
            }

            const win = actor.get_meta_window();
            connect_to_window(win);
        }

        this.create_signal = global.display.connect(
            "window-created",
            (_ignore, win) => {
                dbg_log(`window created ${win}`);

                connect_to_window(win);
            },
        );

        this.hide_signal = overview.connect("hidden", () => {
            // the focus might change whilst we're in the overview, i.e. by
            // searching for an already open app.
            const win = get_focused_window();
            if (win !== null) {
                focus_changed(win);
            }
        });
    }

    // REMINDER: It's required for extensions to clean up after themselves when
    // they are disabled. This is required for approval during review!
    disable() {
        dbg_log(`disabling ${EXT_NAME}`);

        if (this.create_signal !== undefined) {
            global.display.disconnect(this.create_signal);
            this.create_signal = undefined;
        }

        if (this.hide_signal !== undefined) {
            overview.disconnect(this.hide_signal);
            this.hide_signal = undefined;
        }

        for (const actor of global.get_window_actors()) {
            if (actor.is_destroyed()) {
                continue;
            }

            const win = actor.get_meta_window();
            if (win._mousefollowsfocus_extension_signal) {
                win.disconnect(win._mousefollowsfocus_extension_signal);
                delete win._mousefollowsfocus_extension_signal;
            }
            if (win._mousefollowsfocus_extension_signal_2) {
                win.disconnect(win._mousefollowsfocus_extension_signal_2);
                delete win._mousefollowsfocus_extension_signal_2;
            }
        }
    }
}

function get_window_actor(window) {
    for (const actor of global.get_window_actors()) {
        if (!actor.is_destroyed() && actor.get_meta_window() === window) {
            return actor;
        }
    }

    return undefined;
}

function cursor_within_window(mouse_x, mouse_y, win) {
    // use get_buffer_rect instead of get_frame_rect here, because the frame_rect may
    // exclude shadows, which might already cause a focus-on-hover event, therefore causing
    // the pointer to jump around eratically.
    let rect = win.get_buffer_rect();

    dbg_log(`window rect: ${rect.x}:${rect.y} - ${rect.width}:${rect.height}`);

    return (
        mouse_x >= rect.x &&
        mouse_x <= rect.x + rect.width &&
        mouse_y >= rect.y &&
        mouse_y <= rect.y + rect.height
    );
}

function dbg_log(message) {
    if (DEBUGGING) {
        console.log(EXT_NAME, message);
    }
}

function focus_store_last_position(win, mouse_x, mouse_y) {
    if (win != null) {
        let rect2 = win.get_buffer_rect();
        if (cursor_within_window(mouse_x, mouse_y, win)) {
            let px = mouse_x - rect2.x;
            let py = mouse_y - rect2.y;
            if (px > 0 && py > 0) {
                let wt = win.get_title();
                dbg_log(`storing previous position (${px},${py}) of window: ${wt}`);
                win._mousefollowsfocus_last_position = [px, py];
            }
        }
    }
}


let _last_win = null;

let _effect = new Effect();

function mouse_follow_window(win, store_pos) {
    let rect = win.get_buffer_rect();

    let [mouse_x, mouse_y, mods] = global.get_pointer();

    if (store_pos) {
        focus_store_last_position(_last_win, mouse_x, mouse_y);
    } else {
        // always middle
        if (win) {
            win._mousefollowsfocus_last_position = null;
        }
    }

    if (mods & Clutter.ModifierType.BUTTON1_MASK || mods & Clutter.ModifierType.BUTTON2_MASK || mods & Clutter.ModifierType.BUTTON3_MASK || mods & Clutter.ModifierType.BUTTON4_MASK || mods & Clutter.ModifierType.BUTTON5_MASK) {
        dbg_log("button pressed, discarding event");
        _last_win = win;
        return;
    }
    if (rect.width < 10 && rect.height < 10) {
        // xdg-copy creates a 1x1 pixel window to capture mouse events.
        // Ignore this and similar windows.
        dbg_log("window too small, discarding event");
        return;
    } 
    if (overview.visible) {
        dbg_log("overview visible, discarding event");
        return;
    }
    if (win.get_wm_class() == "org.kde.CrowTranslate") {
        return;
    }
    dbg_log(`151 ${mods} ${win.get_wm_class()}`)
    dbg_log(`147 ${win.get_wm_class()}`)

    dbg_log("targeting new window");
    let seat = Clutter.get_default_backend().get_default_seat();
    if (seat === null) { // Use strict equality check
        dbg_log("seat is null!");
        return;
    }

    let sx = 0;
    let sy = 0;
    if (win._mousefollowsfocus_last_position) {
        let wx = win._mousefollowsfocus_last_position[0];
        let wy = win._mousefollowsfocus_last_position[1];
        sx = wx + rect.x;
        sy = wy + rect.y;
        dbg_log(`moving mouse from (${mouse_x},${mouse_y}) to previous position (${sx},${sy})`);
        seat.warp_pointer(sx, sy);
    } else {
        sx = rect.x + rect.width / 2;
        sy = rect.y + rect.height / 2;
        // dbg_log(`targeting new position at middle (${nx},${ny})`);
        seat.warp_pointer(sx, sy);
    }
    _effect.unmagnify();
    _effect.move(sx, sy);
    _last_win = win;
}
function focus_changed(win) {
    const actor = get_window_actor(win);
    dbg_log("window focus event received");

    if (actor) {
        mouse_follow_window(win, true);
    }
}
function position_changed(win) {
    const actor = get_window_actor(win);
    dbg_log("window position changed event received");

    if (actor) {
        mouse_follow_window(win, false);
    }
}

function connect_to_window(win) {
    const type = win.get_window_type();
    if (type !== Meta.WindowType.NORMAL) {
        dbg_log(`ignoring window, window type: ${type}`);
        return;
    }

    win._mousefollowsfocus_extension_signal = win.connect(
        "focus",
        focus_changed,
    );
    win._mousefollowsfocus_extension_signal_2 = win.connect(
        "position-changed",
        position_changed,
    );
}

function get_focused_window() {
    return global.display.focus_window;
}
