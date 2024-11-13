'use strict';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Cursor from './cursor.js';

export default class Effect extends St.Icon {
    static {
        GObject.registerClass(this);
    }

    constructor() {
        super();
        // this.isHidden = true;
        this.unmagnifyDuration = 300;
        this.icon_size = 350;
        this.cursor = new Cursor();
        [this._hotX, this._hotY] = this.cursor.hot;

        // get width seem not work
        this._spriteSize = this.cursor.sprite ? this.cursor.sprite.get_width() : 24;
        this._spriteSize = 32; // must same with `gsettings get org.gnome.desktop.interface cursor-size`

        this._move_hot = 0.5;

        this._pivot_x = 0.5;
        this._pivot_y = 0.5;

        this._pivot = new Graphene.Point({
            x: this._pivot_x,
            y: this._pivot_y,
        });
        this.pivot_point = this._pivot,
        this._ratio = this.icon_size / this._spriteSize;
        this.gicon = Gio.Icon.new_for_string(GLib.path_get_dirname(import.meta.url.slice(7)) + '/icons/cursor.svg');
    }

    move(x, y) {
        // log("Mouse Wiggle", x, y, this._hotX, this._hotY);
        // log("Mouse Wiggle", this._ratio, this._pivot.x, this._pivot.y, this._spriteSize, this.cursor._tracker.get_scale())
        // this.set_position(x - (this._hotX - this._spriteSize/ 2) * this._ratio, y - (this._hotY - this._spriteSizeheight / 2) * this._ratio);
        this.set_position(x - this._pivot_x * (this.icon_size - this._spriteSize) - this._hotX * this._move_hot, y - this._pivot_x * (this.icon_size - this._spriteSize)- this._hotY *this._move_hot);
        // this.set_position(x - this._pivot_x * (this.icon_size - this._spriteSize) - this._hotX, y - this._pivot_x * (this.icon_size - this._spriteSize)- this._hotY);
        // this.set_position(x - this._hotX * this._ratio - this._centerX * (this._ratio- 0), y - this._hotY * this._ratio - this._centerY * (this._ratio-0));
    }

    unmagnify() {
        // if (this._isInTransition) {
        //     return;
        // }
        // this._isInTransition = true;

        Main.uiGroup.add_child(this);
        this.remove_all_transitions();
        this.scale_x = 1;
        this.scale_y = 1;
        // this.scale_x = this._ratio;
        // this.scale_y = this._ratio;
        this.opacity = 100; // 255

        // log("Mouse Wiggle 71", this.scale_x, this.scale_y);
        this._unmagnifyDelayId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.unmagnifyDelay, () => {
            this.remove_all_transitions();
            this.ease({
                duration: this.unmagnifyDuration,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                scale_x: 1.0 / this._ratio,
                scale_y: 1.0 / this._ratio,
                // opacity: 100,
                onComplete: () => {
                    Main.uiGroup.remove_child(this);
                    // if (this.isHidden) {
                    //     this.cursor.show();
                    // }
                    // this.isWiggling = false;
                    // this._isInTransition = false;
                },
            });
        });
    }

    destroy() {
        if (this._unmagnifyDelayId) {
            GLib.source_remove(this._unmagnifyDelayId);
        }
    }
}
