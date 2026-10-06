# 弹弓小鸟

无声的网页弹弓游戏，包含三关、木架物理碰撞、目标击倒、得分、暂停和重开。

## 运行

将压缩包完整解压后，用现代浏览器打开 index.html 即可游玩。也可将全部文件放到任意静态网站或 GitHub Pages 中；所有游戏依赖已放在本地，无需安装或联网加载第三方脚本。

## 操作

- 拖住红色小鸟向后拉，松开发射；白色点显示预估轨迹。
- 触屏使用相同操作，手机横屏更舒适。
- 方向键调整瞄准，空格或回车发射，Esc 取消瞄准，R 重开。
- 每关三只小鸟，击倒全部绿色目标过关。绿色目标 500 分，木块 50 分，每只剩余小鸟奖励 300 分。

## 源码

- index.html：页面结构
- style.css：界面和响应式样式
- game.js：玩法、绘制、关卡和碰撞得分
- matter.min.js：Matter.js 0.20.0，MIT 许可见 MATTER-LICENSE.txt
- landscape.png：内置 image_gen 生成的原创背景

背景提示词：Cheerful 2D slingshot physics game landscape, polished handcrafted children's illustration. Bright blue sky, soft clouds, distant rounded teal hills and tiny shrubs, warm sunlight. Flat grassy ground horizontally at 78% image height, earthy soil below. Wide side-on composition with unobstructed gameplay space across the image; distant details remain low contrast. No characters, birds, pigs, buildings, foreground objects, text, UI, logos, or watermarks.

验证：真实物理引擎中三个关卡均能在三次发射以内通关；检查了失败、重开、暂停、键盘发射、手机布局和操作输入验证。
