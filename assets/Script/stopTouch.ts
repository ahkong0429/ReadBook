const { ccclass } = cc._decorator;
@ccclass
export default class NewClass extends cc.Component {
  onLoad() {
    // 防止穿透
    this.node.on(cc.Node.EventType.TOUCH_START, (event) => {
      event.stopPropagation()
    })
  }
}
