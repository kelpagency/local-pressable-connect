"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const PressableConnect_1 = __importDefault(require("./PressableConnect"));
function default_1(context) {
    const { hooks } = context;
    hooks.addFilter('siteInfoToolsItem', (menu) => [
        ...menu,
        { menuItem: 'Pressable Connect', path: '/pressable-connect', render: (props) => React.createElement(PressableConnect_1.default, Object.assign({}, props)) },
    ]);
}
exports.default = default_1;
//# sourceMappingURL=renderer.js.map