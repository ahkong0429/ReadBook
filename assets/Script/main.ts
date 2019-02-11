const { ccclass, property } = cc._decorator;
import * as io from "./socket.io";
import * as _ from "lodash";
const WebSocketHost = "http://63.223.103.49:6031";

@ccclass
export default class main extends cc.Component {

  // @property(cc.Label)
  // label: cc.Label = null;

  // @property
  // text: string = 'hello';

  // 输入框
  @property(cc.EditBox)
  input: cc.EditBox = null;

  // tip界面节点
  @property(cc.Node)
  tip: cc.Node = null;

  // 页面预制体
  @property(cc.Prefab)
  pageItem: cc.Prefab = null;

  // 列表预制体
  @property(cc.Prefab)
  listItem: cc.Prefab = null;

  // 段落预制体
  @property(cc.Prefab)
  artItem: cc.Prefab = null;

  // 目录预制体
  @property(cc.Prefab)
  muluItem: cc.Prefab = null;

  // 页面容器
  @property(cc.Node)
  pageBox: cc.Node = null;

  // 是否登陆
  @property(Boolean)
  isLogin: Boolean = false;

  // 失败次数
  @property(Number)
  errTimes: number = 0;
  @property(Number)
  errTimesTest: number = 0;
  @property
  errTimesBg = {};

  // socket客户端
  @property
  client = null;

  // link对照表
  @property
  linkDictionary = {};

  // 页数
  @property
  linkPages = {};

  // 用户信息
  @property
  user = { token: false, nickname: false };

  // 当前正在读的书
  @property
  reading = '';

  // 内存缓存文字内容
  // 坑爹玩意儿不知道为啥字数多了就渲染不了
  @property
  readingContent = { now: 0, all: [] };

  // 翻页参数
  @property
  pageNum = 1;

  // 皮肤
  @property
  skins = {
    defaults: {
      sname: 'default',
      bgColor: new cc.Color().fromHEX('#E7FFE6'),
      fontColor: new cc.Color().fromHEX('#333333'),
    },
    midnight: {
      sname: 'midnight',
      bgColor: new cc.Color().fromHEX('#333333'),
      fontColor: new cc.Color().fromHEX('#dddddd'),
    },
  }
  @property
  fontsize = 24;
  lineheight = 30;

  onLoad() {
    // 设置
    let setting = this.cacheGet('abook-setting');
    setting = setting || {
      skins: this.skins.defaults,
      fontsize: this.fontsize,
      lineheight: this.lineheight,
    }
    this.fontsize = setting.fontsize;
    this.lineheight = setting.lineheight;
    this.cacheSave('abook-setting', setting);

    this.node.getChildByName('mulu').active = false;
    this.showSearchPage();
    this.hideLoading();
    this.showLoading('游客登陆中...');
    this.login();
  }

  // 查询方法
  searchFun(initPage?) {
    if (initPage) {
      this.pageNum = 1;
    }
    // console.log(this.input.string);
    if (this.user && this.user.token) {
      this.showLoading();
      this.client.emit("lookup", this.user.token, this.input.string, this.pageNum, (res) => {
        // console.log(res);
        if (!res) {
          console.log(`查询太频繁`);
        }
      })
    }
  }

  // 加载loading界面
  showLoading(txt = '正在查询...') {
    this.tip.active = true;
    this.tip.getChildByName("loading").active = true;
    this.tip.getChildByName("loading").getChildByName("txt").getComponent(cc.Label).string = txt;
  }

  // 隐藏loading界面
  hideLoading() {
    this.tip.active = false;
    this.tip.getChildByName("loading").active = false;
    this.tip.getChildByName("tip").active = false;
  }

  // 展示提示消息
  showTip(content = '提示消息') {
    this.tip.active = true;
    this.tip.getChildByName("tip").getChildByName("bg").getChildByName("txt").getComponent(cc.Label).string = content;
    this.tip.getChildByName("tip").active = true;
  }
  showTipOkFun() {
    this.hideLoading();
  }

  // 游客登陆
  login() {
    this.client = io(WebSocketHost);
    this.client.on('connect', () => {
      if (!this.client.connected) {
        return console.log(`socket connected ERR`);
      }
      if (!this.isLogin) {
        this.hideLoading();
        this.isLogin = true;
      }
    });
    this.client.on('disconnect', () => {
      if (!this.client.connected) {
        console.log(`socket disconnect`);
      }
    });
    this.client.on('reconnecting', () => {
      console.log(`socket reconnecting`);
    });
    this.client.on('reconnect_error', () => {
      console.log(`socket reconnect_error`);
    });
    this.client.on('reconnect', () => {
      console.log(`socket reconnect OK`);
      this.hideLoading();
    });
    // ====================
    this.client.on('conn', (result) => {
      // console.log(result);
      if (result && result.code == '200') {
        console.log(`socket conn OK`);
        let userjson = cc.sys.localStorage.getItem('abook-user')
        if (userjson) {
          let user = JSON.parse(userjson)
          if (user.token) {
            console.log(user);
            this.user = user;
            return;
          }
        }
        // 注册游客账号
        this.client.emit("GetGuestAccount", (user) => {
          console.log(user);
          this.user = user;
          cc.sys.localStorage.setItem('abook-user', JSON.stringify(user));
        });
      }
    });
    // 收到来自服务端的查询结果
    this.client.on('getSearchResult', (result) => {
      // console.log(result);
      if (result.list.length <= 0) {
        this.errTimes++;
        if (this.errTimes < 4) {
          setTimeout(() => {
            this.searchFun();
          }, 2000);
          return;
        }
        // 连续失败3次无结果
        this.hideLoading();
        this.errTimes = 0;
        this.showTip('查询无结果');
        return;
      }

      // if (!result.page.link) {
      //   setTimeout(() => {
      //     this.searchFun();
      //   }, 1000);
      //   return
      // }

      // 页码
      let page = result.page;
      if (page.length > 0) {
        let arr = page[page.length - 1].link.split('page=');
        let total = arr[arr.length - 1] * 1;
        if (this.pageNum < total && result.list.length < 10) {
          setTimeout(() => {
            this.searchFun();
          }, 2000);
          return
        }
      }

      this.errTimes = 0;
      this.renderList(result)
    });
    // 收到来自服务端的查询结果
    // this.client.on('getBookContentBack', (link, result) => {
    //   console.log(result);
    //   this.hideLoading();
    //   if (result && result.length > 0) {
    //     let cache = cc.sys.localStorage.getItem(`abook-${link}`);
    //     cache = cache ? JSON.parse(cache) : [];
    //     if (cache.length < result.length) {
    //       // 缓存到本地
    //       cc.sys.localStorage.setItem(`abook-${link}`, JSON.stringify(result));
    //       this.readBookByIndex(link);
    //     }
    //     return;
    //   }
    //   this.showTip('查询无结果');
    // });
  }

  // 渲染列表
  renderList(data) {
    let list = data.list;
    let page = data.page;
    // 页码
    let arr = (page.length > 0) ? (page[page.length - 1].link.split('page=')) : [1];
    let total = arr[arr.length - 1] * 1;
    let pageShow = `${this.pageNum}/${total}`;

    let contentWidth = 0;
    let pageview = this.pageBox.parent.parent.getComponent(cc.PageView);
    pageview.removeAllPages();
    _.forEach(list, (item) => {
      let sigWidth = cc.winSize.width;
      // console.log(sigWidth);
      // console.log(this.pageBox.parent.width);
      contentWidth = contentWidth * 1 + sigWidth * 1;
      // 每个页面
      let clone = cc.instantiate(this.pageItem);
      clone.width = sigWidth;
      // clone.parent = this.pageBox;
      clone.active = true;
      // face
      if (item.face) {
        this.loadUrlImg(item.newface, (frame) => {
          clone.getChildByName("face").getComponent(cc.Sprite).spriteFrame = frame;
        })
      }
      // title
      if (item.title) {
        clone.getChildByName("info").getChildByName("title").getComponent(cc.Label).string = `《${item.title}》`;
      }
      // content
      if (item.content) {
        clone.getChildByName("info").getChildByName("content").getComponent(cc.Label).string = item.content;
      }
      // author
      if (item.author) {
        clone.getChildByName("info").getChildByName("author").getComponent(cc.Label).string = `作者:${item.author}`;
      }
      // lastUpdateDate
      if (item.lastUpdateDate) {
        clone.getChildByName("info").getChildByName("date").getComponent(cc.Label).string = `最后更新时间:${item.lastUpdateDate}`;
      }
      // lastArticleTitle
      if (item.lastArticleTitle) {
        clone.getChildByName("info").getChildByName("last").getComponent(cc.Label).string = `最新章节:${item.lastArticleTitle}`;
      }
      // link
      if (item.link) {
        // 更新对照表
        this.linkDictionary[item.link] = item;
        // clickevent
        var clickEvent = new cc.Component.EventHandler();
        clickEvent.target = this.node;
        clickEvent.component = "main";
        clickEvent.handler = "readBook";
        clickEvent.customEventData = item.link;
        let button = clone.getChildByName("read").getComponent(cc.Button)
        button.clickEvents.push(clickEvent);
      }
      clone.getChildByName("page").getComponent(cc.Label).string = pageShow;
      pageview.addPage(clone);
      // this.pageBox.getComponent(cc.Layout).updateLayout();
      // console.log(clone);
    })
    this.pageBox.width = contentWidth;
    pageview.stopAutoScroll()
    pageview.scrollToLeft(0)
    this.hideLoading();
    // console.log(this.pageBox.parent.parent.getComponent(cc.PageView))
    // console.log(`width${contentWidth}`)

    // event
    pageview.node.off('bounce-left')
    pageview.node.on('bounce-left', () => {
      this.pageNum--;
      if (this.pageNum < 1) {
        this.pageNum = 1;
        return;
      }
      this.searchFun();
    })
    pageview.node.off('bounce-right')
    pageview.node.on('bounce-right', () => {
      this.pageNum++;
      this.searchFun();
    })
  }

  // 保存阅读历史
  saveReadHistory(link) {
    let data = this.linkDictionary[link];
    if (!data) return;
    // read history
    let his = cc.sys.localStorage.getItem('abook-history');
    his = his ? JSON.parse(his) : [];
    let find = _.find(his, (o) => {
      return o.link == link;
    })
    if (!find) {
      his.push({
        link: link,
        item: data
      });
      cc.sys.localStorage.setItem('abook-history', JSON.stringify(his));
    }
  }

  // 加载网络图片，仅限可跨域站点
  loadUrlImg(url, callback) {
    cc.loader.load(url, (err, texture) => {
      if (err == null) {
        var newframe = new cc.SpriteFrame(texture);
        if (callback) callback(newframe)
        return;
      }
      console.log(err);
    })
  }

  // 读书
  readBook(evt, link) {
    // console.log(link);
    this.reading = link;
    this.saveReadHistory(link);
    this.showBookReading();
    // let contentNode = this.node.getChildByName("reading").getChildByName("book").getChildByName("view").getChildByName("content");
    // contentNode.getComponent(cc.Label).string = '';

    // title
    this.node.getChildByName("reading").getChildByName("title").getChildByName("text").getComponent(cc.Label).string = '';
    let his = cc.sys.localStorage.getItem('abook-history');
    his = his ? JSON.parse(his) : [];
    let find = _.find(his, (o) => {
      return o.link == link;
    })
    // console.log(find);
    // 提升排序
    let newarr = [find];
    _.forEach(his, (o) => {
      if (o.link !== find.link) {
        newarr.push(o);
      }
    })
    cc.sys.localStorage.setItem('abook-history', JSON.stringify(newarr));
    if (find) {
      this.node.getChildByName("reading").getChildByName("title").getChildByName("text").getComponent(cc.Label).string = find.item.title;
    }
    this.setTitle();
    // 更新数据中
    this.client.emit("getBookContent", this.user.token, link);
    // 开始请求最新数据
    this.readBookByIndex(link);
  }

  // 设置文章标题
  setTitle(txt?) {
    let link = this.reading;
    // title
    this.node.getChildByName("reading").getChildByName("title").getChildByName("text").getComponent(cc.Label).string = '';
    let his = cc.sys.localStorage.getItem('abook-history');
    his = his ? JSON.parse(his) : [];
    let find = _.find(his, (o) => {
      return o.link == link;
    })
    if (find) {
      this.node.getChildByName("reading").getChildByName("title").getChildByName("text").getComponent(cc.Label).string = find.item.title + (txt ? ('-' + txt) : '');
    }
  }

  readArt(evt, artNum) {
    let link = this.reading;
    this.showLoading('正在读取章节内容...');
    this.readBookByIndex(link, artNum)
  }

  // 读章
  readBookByIndex(link, artNum?) {
    this.backgroundCacheArticle(link);
    let contentNode = this.node.getChildByName("reading").getChildByName("book").getChildByName("view").getChildByName("content");
    if (contentNode.children && contentNode.children.length > 0) {
      _.forEach(contentNode.children, (node) => {
        node.destroy()
      })
    }
    // contentNode.getComponent(cc.Label).string = '';
    let index = cc.sys.localStorage.getItem(`abook-${link}-index`);
    index = index ? index : 1;
    if (index < 1) {
      index = 1;
    }
    index = artNum ? artNum : index;
    cc.sys.localStorage.setItem(`abook-${link}-index`, index);

    let art = this.cacheGet(`abook-art-${link}`);
    art = art || {};
    if (!art[index]) {
      this.errTimes++;
      if (this.errTimes >= 10) {
        this.errTimes = 0;
        this.hideLoading();
        this.showTip('服务器正在爬取数据中，请稍后再查看');
        if (index > 1) {
          index = index - 1;
          cc.sys.localStorage.setItem(`abook-${link}-index`, index);
        }
        return;
      }
      setTimeout(() => {
        this.readBookByIndex(link, artNum);
      }, 1000);
      return;
    }
    let result = art[index];
    this.errTimes = 0;
    this.hideLoading();
    this.readingContent = {
      now: 0,
      all: this.getNowCon(result.content)
    }
    this.setTitle(result.title);
    this.node.getChildByName('mulu').active = false;
    // 个人设置
    let setting = this.cacheGet('abook-setting');
    this.node.getChildByName("reading").getChildByName("book").color = setting.skins.bgColor;
    _.forEach(this.readingContent.all, (art) => {
      let clone = cc.instantiate(this.artItem);
      clone.getComponent(cc.Label).fontSize = setting.fontsize;
      clone.getComponent(cc.Label).lineHeight = setting.lineheight;
      clone.color = setting.skins.fontColor;
      clone.getComponent(cc.Label).string = art;

      clone.parent = contentNode;
      clone.active = true;
    })
    this.node.getChildByName("reading").getChildByName("book").getComponent(cc.ScrollView).stopAutoScroll();
    this.node.getChildByName("reading").getChildByName("book").getComponent(cc.ScrollView).scrollToTop(0);

    return;
    this.client.emit("getBookArticleByIndex", this.user.token, link, index, (result) => {
      // console.log(result);
      if (!result) {
        this.errTimes++;
        // console.log(this.errTimes);
        if (this.errTimes >= 10) {
          this.errTimes = 0;
          this.hideLoading();
          this.showTip('查询无结果');
          if (index > 1) {
            index = index - 1;
            cc.sys.localStorage.setItem(`abook-${link}-index`, index);
          }
          return;
        }
        setTimeout(() => {
          this.readBookByIndex(link, artNum);
        }, 1000);
        return;
      }
      this.errTimes = 0;
      this.hideLoading();
      this.readingContent = {
        now: 0,
        all: this.getNowCon(result.content)
      }
      // this.setTitle(result.title + `(1/${this.readingContent.all.length})`);
      this.setTitle(result.title);
      this.node.getChildByName('mulu').active = false;
      // console.log(this.readingContent);
      // let con = this.readingContent.all[this.readingContent.now]
      // contentNode.getComponent(cc.Label).string = '\n' + con;
      _.forEach(this.readingContent.all, (art) => {
        let clone = cc.instantiate(this.artItem);
        clone.getComponent(cc.Label).string = art;
        clone.parent = contentNode;
        clone.active = true;
      })
      // contentNode.getComponent(cc.Label).string = '\n' + result.content + '\n';
      // 滚动到底部再append
      // this.node.getChildByName("reading").getChildByName("book").off('scroll-to-bottom');
      // this.node.getChildByName("reading").getChildByName("book").on('scroll-to-bottom', () => {
      //   // console.log('scroll-to-bottom', this.readingContent.now);
      //   this.setTitle(result.title + `(${((this.readingContent.now + 1) >= this.readingContent.all.length ? this.readingContent.all.length : (this.readingContent.now + 1))}/${this.readingContent.all.length})`);
      //   let next = this.nextCon();
      //   if (next) {
      //     contentNode.getComponent(cc.Label).string = next;
      //     this.node.getChildByName("reading").getChildByName("book").getComponent(cc.ScrollView).stopAutoScroll();
      //     this.node.getChildByName("reading").getChildByName("book").getComponent(cc.ScrollView).scrollToTop(0);
      //   }
      // })
      // // 滚动到底部回弹下一章
      // this.node.getChildByName("reading").getChildByName("book").off('bounce-bottom');
      // this.node.getChildByName("reading").getChildByName("book").on('bounce-bottom', () => {
      //   // console.log(this.readingContent.now)
      //   if ((this.readingContent.now) >= (this.readingContent.all.length)) {
      //     this.nextArticle();
      //   }
      // })
      // // 滚动到底部回弹上一章
      // this.node.getChildByName("reading").getChildByName("book").off('bounce-top');
      // this.node.getChildByName("reading").getChildByName("book").on('bounce-top', () => {
      //   this.prevArticle();
      // })
      // console.log(contentNode.color)
      // contentNode.color = new cc.Color(51, 51, 51, 255);
      // this.showTip(result.content.length);
      this.node.getChildByName("reading").getChildByName("book").getComponent(cc.ScrollView).stopAutoScroll();
      this.node.getChildByName("reading").getChildByName("book").getComponent(cc.ScrollView).scrollToTop(0);
    })
    // let cache = cc.sys.localStorage.getItem(`abook-${link}`);
    // cache = cache ? JSON.parse(cache) : false;
    // if (cache) {
    //   let index = cc.sys.localStorage.getItem(`abook-${link}-index`);
    //   index = index ? index : 1;
    //   cc.sys.localStorage.setItem(`abook-${link}-index`, index);
    //   if (cache[index - 1]) {
    //     this.hideLoading();
    //     let article = cache[index - 1];
    //     contentNode.getComponent(cc.Label).string = article.title + '\r\n' + article.content;
    //     this.node.getChildByName("reading").getChildByName("book").getComponent(cc.ScrollView).scrollToTop(0);
    //   }
    // }
  }

  nextCon() {
    this.readingContent.now = this.readingContent.now * 1 + 1;
    if ((this.readingContent.now) <= (this.readingContent.all.length - 1)) {
      return this.readingContent.all[this.readingContent.now] + ((this.readingContent.now) == (this.readingContent.all.length - 1) ? '\n\n' : '')
    }
    return false
  }

  // 获取当前页内容
  getNowCon(content) {
    let arr = content.split('\n');
    let newarr = [];
    let str = '';
    _.forEach(arr, (art, idx) => {
      if ((str.length * 1 + art.length * 1) > 1000) {
        newarr.push(str);
        str = '';
      } else {
        str = str + (str == '' ? '' : '\n') + art;
        if (Number(idx) == (arr.length - 1)) {
          newarr.push(str);
          str = '';
        }
      }
    })
    return newarr;
  }

  // 切换到找书页面
  showSearchPage() {
    this.showLoading('正在加载数据...');
    this.node.getChildByName("searchBox").active = true;
    this.node.getChildByName("contentBox").active = true;
    this.node.getChildByName("bookList").active = false;
    this.node.getChildByName("reading").active = false;
    this.node.getChildByName('setting').active = false;
    this.hideLoading();
  }

  // 切换到书架
  showBookList() {
    this.showLoading('正在读取书架...');
    this.node.getChildByName("searchBox").active = false;
    this.node.getChildByName("contentBox").active = false;
    this.node.getChildByName("bookList").active = true;
    this.node.getChildByName("reading").active = false;
    this.node.getChildByName('mulu').active = false;
    this.node.getChildByName('setting').active = false;
    this.renderBookList();
  }

  // 切换到读书
  showBookReading() {
    this.showLoading('正在加载章节信息...');
    this.node.getChildByName("searchBox").active = false;
    this.node.getChildByName("contentBox").active = false;
    this.node.getChildByName("bookList").active = false;
    this.node.getChildByName("reading").active = true;
    this.node.getChildByName('mulu').active = false;
    this.node.getChildByName('setting').active = false;
  }

  // 切换到设置
  showSetting() {
    this.showLoading('正在加载个人设置...');

    // 读取设置
    let setting = this.cacheGet('abook-setting');
    setting = setting || {
      skins: this.skins.defaults,
      fontsize: this.fontsize,
      lineheight: this.lineheight,
    }
    this.node.getChildByName('setting').getChildByName('main').getChildByName('list').getChildByName('fz').getChildByName('value').getComponent(cc.Label).string = setting.fontsize.toString();
    if (setting.skins.sname == 'default') {
      this.node.getChildByName('setting').getChildByName('main').getChildByName('list').getChildByName('skin').getChildByName('radio').getChildByName('toggle1').getComponent(cc.Toggle).isChecked = true;
      this.node.getChildByName('setting').getChildByName('main').getChildByName('list').getChildByName('skin').getChildByName('radio').getChildByName('toggle2').getComponent(cc.Toggle).isChecked = false;
    }
    if (setting.skins.sname == 'midnight') {
      this.node.getChildByName('setting').getChildByName('main').getChildByName('list').getChildByName('skin').getChildByName('radio').getChildByName('toggle1').getComponent(cc.Toggle).isChecked = false;
      this.node.getChildByName('setting').getChildByName('main').getChildByName('list').getChildByName('skin').getChildByName('radio').getChildByName('toggle2').getComponent(cc.Toggle).isChecked = true;
    }

    let fz = setting.fontsize;
    this.node.getChildByName('setting').getChildByName('main').getChildByName('list').getChildByName('fz').getChildByName('slider').getComponent(cc.Slider).progress = (fz / 32);

    this.node.getChildByName("searchBox").active = false;
    this.node.getChildByName("contentBox").active = false;
    this.node.getChildByName("bookList").active = false;
    this.node.getChildByName("reading").active = false;
    this.node.getChildByName('mulu').active = false;
    this.node.getChildByName('setting').active = true;
    this.hideLoading();
  }

  // 渲染书架
  renderBookList() {
    // 清空列表
    let contentNode = this.node.getChildByName("bookList").getChildByName("list").getChildByName("view").getChildByName("content");
    if (contentNode.children && contentNode.children.length > 0) {
      _.forEach(contentNode.children, (node) => {
        node.destroy();
      })
    }

    let his = cc.sys.localStorage.getItem('abook-history');
    his = his ? JSON.parse(his) : [];
    // console.log(his);
    if (his && his.length > 0) {
      // 插入列表
      _.forEach(his, (item) => {
        // update last article
        this.updateLastData(item.link);
        let clone = cc.instantiate(this.listItem);
        if (item.item.face) {
          this.loadUrlImg(item.item.newface, (frame) => {
            clone.getChildByName("face").getComponent(cc.Sprite).spriteFrame = frame;
          })
        }
        clone.getChildByName("info").getChildByName("title").getComponent(cc.Label).string = item.item.title;
        clone.getChildByName("info").getChildByName("last").getComponent(cc.Label).string = item.item.lastArticleTitle;
        // clickevent
        let clickEvent = new cc.Component.EventHandler();
        clickEvent.target = this.node;
        clickEvent.component = "main";
        clickEvent.handler = "readBook";
        clickEvent.customEventData = item.link;
        let clickEvent2 = new cc.Component.EventHandler();
        clickEvent2.target = this.node;
        clickEvent2.component = "main";
        clickEvent2.handler = "delHis";
        clickEvent2.customEventData = item.link;
        // clone.addComponent(cc.Button);
        // let button = clone.getComponent(cc.Button)
        let con = clone.getChildByName("slider").getChildByName("view").getChildByName("content");
        let button1 = con.getChildByName("btn1").getComponent(cc.Button);
        let button2 = con.getChildByName("btn2").getComponent(cc.Button);
        button1.clickEvents.push(clickEvent);
        button2.clickEvents.push(clickEvent2);
        clone.parent = contentNode;
        clone.active = true;
      })
      // contentNode.getComponent(cc.Layout).updateLayout();
    }
    this.hideLoading();
  }

  // 删除历史记录
  delHis(evt, link: String) {
    let his = cc.sys.localStorage.getItem('abook-history');
    his = his ? JSON.parse(his) : [];
    _.remove(his, (o: { link: String }) => {
      return o.link == link
    })
    cc.sys.localStorage.setItem('abook-history', JSON.stringify(his))
    // 同步删除章节缓存
    cc.sys.localStorage.removeItem(`abook-art-${link}`);
    // 读书记录
    cc.sys.localStorage.removeItem(`abook-${link}-index`);
    // 目录
    cc.sys.localStorage.removeItem(`abook-mulu-${link}`);
    this.renderBookList();
  }

  // 上一章
  prevArticle() {
    let link = this.reading;
    let index = cc.sys.localStorage.getItem(`abook-${link}-index`);
    index = index ? index : 1;
    index = index * 1 - 1;
    if (index < 1) {
      index = 1;
      cc.sys.localStorage.setItem(`abook-${link}-index`, index);
      return;
    }
    cc.sys.localStorage.setItem(`abook-${link}-index`, index);
    this.showLoading('正在加载章节内容...');
    this.readBookByIndex(link);
  }

  // 下一章
  nextArticle() {
    let link = this.reading;
    let index = cc.sys.localStorage.getItem(`abook-${link}-index`);
    index = index ? index : 1;
    index = index * 1 + 1;
    if (index < 1) {
      index = 1;
      cc.sys.localStorage.setItem(`abook-${link}-index`, index);
      return;
    }
    // console.log(index, this.linkPages[link]);
    if (this.linkPages[link]) {
      if (index > this.linkPages[link]) {
        index = this.linkPages[link];
        cc.sys.localStorage.setItem(`abook-${link}-index`, index);
        return;
      }
      this.showLoading('正在加载章节内容...');
      cc.sys.localStorage.setItem(`abook-${link}-index`, index);
      this.readBookByIndex(link);
    }
  }

  // 打开目录
  showMulu(evt?, clickstr?) {
    let muluNode = this.node.getChildByName('mulu');
    let content = muluNode.getChildByName('list').getChildByName('view').getChildByName('content');
    let link = this.reading;
    if (!muluNode.active) {
      this.showLoading('正在加载目录...');
      if (clickstr == 'click') {
        muluNode.active = true;
      }
      if (content.children && content.children.length > 0) {
        _.forEach(content.children, (n) => {
          n.destroy()
        })
      }
      muluNode.getChildByName("list").getComponent(cc.ScrollView).stopAutoScroll();
      let cache = this.cacheGet(`abook-mulu-${link}`)
      if (cache) {
        this.renderMulu(cache);
      }
      // this.updateLastData(link);
      this.client.emit('getMulu', this.user.token, link, (res) => {
        // console.log(res);
        if (!res) {
          this.errTimes++;
          if (this.errTimes > 4) {
            this.hideLoading();
            this.errTimes = 0;
            muluNode.active = false;
            return;
          }
          setTimeout(() => {
            this.showMulu();
          }, 1000);
          return;
        }
        this.errTimes = 0;
        if (res && res.length > 0) {
          // console.log(res);
          cache = (!cache) ? [] : cache;
          if (res.length > cache.length) {
            this.cacheSave(`abook-mulu-${link}`, res);
            this.renderMulu(res);
          }
        }
      })
      return;
    }
    if (clickstr == 'click') {
      if (muluNode.active) {
        muluNode.active = false;
      }
    }
  }

  // 渲染目录
  renderMulu(res) {
    let muluNode = this.node.getChildByName('mulu');
    let content = muluNode.getChildByName('list').getChildByName('view').getChildByName('content');
    _.forEach(res, async (item) => {
      let clone = cc.instantiate(this.muluItem);
      clone.getChildByName('info').getChildByName('title').getComponent(cc.Label).string = item.title;
      clone.parent = content;
      var clickEvent = new cc.Component.EventHandler();
      clickEvent.target = this.node;
      clickEvent.component = "main";
      clickEvent.handler = "readArt";
      clickEvent.customEventData = item.num;
      let button = clone.getComponent(cc.Button)
      button.clickEvents.push(clickEvent);
      clone.active = true;
    })
    content.getComponent(cc.Layout).updateLayout();

    let link = this.reading;
    let index = this.cacheGet(`abook-${link}-index`);
    let max = res.length;
    if (index) {
      index = index < 1 ? 1 : index;
      index = index > max ? max : index;
    }
    let per = 1 - (index / max);
    this.slideToMy(per);
  }

  slideToMy(per) {
    let muluNode = this.node.getChildByName('mulu');
    let scroll = muluNode.getChildByName("list").getComponent(cc.ScrollView);
    // let prog = muluNode.getChildByName('slide').getComponent(cc.Slider).progress;
    let prog = this.getScrollPer();
    let diff = prog - per;
    scroll.scrollToPercentVertical(per, 0.1);
    // console.log(diff);
    if (diff > 0.1) {
      setTimeout(() => {
        this.slideToMy(per);
      }, 500);
      return
    }
    this.hideLoading();
    // console.log(prog);
  }

  // 更新最新章节数据
  updateLastData(link) {
    this.client.emit('getMulu', this.user.token, link, (res) => {
      if (!res) {
        this.errTimesTest++;
        if (this.errTimesTest > 4) {
          this.errTimesTest = 0;
          return;
        }
        setTimeout(() => {
          this.updateLastData(link);
        }, 1000);
        return;
      }
      this.errTimesTest = 0;
      this.linkPages[link] = res.length;
      // 更新history
      let his = cc.sys.localStorage.getItem('abook-history');
      his = his ? JSON.parse(his) : [];
      let find = _.find(his, (o) => {
        return o.link == link;
      })
      if (find) {
        find.item.lastArticleTitle = res[res.length - 1].title;
        his = _.map(his, (o) => {
          if (o.link == link) {
            o = find;
          }
          return o;
        })
        cc.sys.localStorage.setItem('abook-history', JSON.stringify(his))
      }
    })
  }

  // 目录滚动器，优化用户体验
  slideFun(slider) {
    let muluNode = this.node.getChildByName('mulu');
    let scroll = muluNode.getChildByName('list').getComponent(cc.ScrollView);
    scroll.scrollToPercentVertical(slider.progress, 0.1)
  }
  getScrollPer() {
    let contentNode = this.node.getChildByName("mulu").getChildByName("list").getChildByName("view");
    let muluNode = this.node.getChildByName('mulu');
    let scroll = muluNode.getChildByName('list').getComponent(cc.ScrollView);
    let pos = scroll.getContentPosition().toString();
    let y = pos.split(',')[1].replace(/\)/, '');
    let now = Number(y) - contentNode.y;
    now = now < 1 ? 1 : now;
    let max = scroll.getMaxScrollOffset().y;
    let per = now / max;
    per = per <= 0 ? 0 : per;
    per = per >= 1 ? 1 : per;
    per = 1 - per;
    return per;
  }
  // 滚动器目录联动
  scrollFun(scroll: cc.ScrollView) {
    let per = this.getScrollPer();
    let slide = this.node.getChildByName('mulu').getChildByName('slide');
    slide.getComponent(cc.Slider).progress = per;
  }

  // 缓存数据机制，缓存localstorge，优化用户体验
  cacheSave(key, data) {
    cc.sys.localStorage.setItem(key, JSON.stringify(data))
  }
  cacheGet(key) {
    let json = cc.sys.localStorage.getItem(key)
    if (json) {
      return JSON.parse(json)
    }
    return false;
  }


  // 后台更新章节缓存
  // 保留当前读的和前5章，往后50章
  backgroundCacheArticle(link) {
    let more = 50;
    // console.log(link)
    let mulu = this.cacheGet(`abook-mulu-${link}`)
    if (!mulu) {
      setTimeout(() => {
        this.backgroundCacheArticle(link)
      }, 1000);
      return
    }
    if (mulu && mulu.length > 0) {
      // console.log(mulu)
      let max = mulu.length;
      // 当前章节
      let index = this.cacheGet(`abook-${link}-index`);
      if (index) {
        index = index < 1 ? 1 : index;
        index = index > max ? max : index;
        let start = (index - 5) < 1 ? 1 : (index - 5);
        let end = (index * 1 + more) > max ? max : (index * 1 + more);
        // 删除小于start的键值对
        let art = this.cacheGet(`abook-art-${link}`);
        art = art || {};
        let keys = _.keys(art);
        keys = _.map(keys, (o) => {
          if (Number(o) < start) { return o }
        })
        _.forEach(keys, (v) => {
          delete art[v]
        })
        this.cacheSave(`abook-art-${link}`, art);
        this.bkGetArt(link, start, end, start);
      }
      // console.log(index);
    }
  }

  // 获取章节缓存的后台进程
  bkGetArt(link, start, end, i) {
    this.errTimesBg[link] = this.errTimesBg[link] || {};
    this.errTimesBg[link][i] = this.errTimesBg[link][i] || 0;
    this.client.emit("getBookArticleByIndex", this.user.token, link, i, (result) => {
      if (!result) {
        this.errTimesBg[link][i]++;
        if (this.errTimesBg[link][i] > 10) {
          this.errTimesBg[link][i] = 0;
          return
        }
        setTimeout(() => {
          this.bkGetArt(link, start, end, i);
        }, 1000);
        return
      }
      this.errTimesBg[link][i] = 0;
      let art = this.cacheGet(`abook-art-${link}`);
      art = art || {};
      art[i] = result;
      this.cacheSave(`abook-art-${link}`, art);
      if (i < end) {
        i++;
        this.bkGetArt(link, start, end, i);
      }
    })
  }

  // 更改设置
  changeFontSize(slider) {
    let min = 16;
    let max = 32;
    let newsize = _.round(min + (max - min) * slider.progress);
    this.node.getChildByName('setting').getChildByName('main').getChildByName('list').getChildByName('fz').getChildByName('value').getComponent(cc.Label).string = newsize.toString();
    let setting = this.cacheGet('abook-setting');
    setting = setting || {
      skins: this.skins.defaults,
      fontsize: this.fontsize,
      lineheight: this.lineheight,
    }
    setting.fontsize = newsize;
    setting.lineheight = newsize * 1.5;
    this.cacheSave('abook-setting', setting);
  }

  // 换肤
  changeSkin(toggle, value) {
    let setting = this.cacheGet('abook-setting');
    setting = setting || {
      skins: this.skins.defaults,
      fontsize: this.fontsize,
      lineheight: this.lineheight,
    }
    this.node.getChildByName('setting').getChildByName('main').getChildByName('list').getChildByName('skin').getChildByName('radio').getChildByName(`toggle${value}`).getComponent(cc.Toggle).isChecked = true;
    // console.log(toggle, value);
    if (value == '1') {
      setting.skins = this.skins.defaults;
    }
    if (value == '2') {
      setting.skins = this.skins.midnight;
    }
    // console.log(setting);
    this.cacheSave('abook-setting', setting);
  }

  // start() {
  //   // init logic
  //   // this.label.string = this.text;
  // }
}
