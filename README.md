# 持ち物チェック (mochimono)

毎日決めた時刻に「持ち物は全部ありますか?」とポップアップを出すアプリです。
**全項目にチェックを入れるまでポップアップは閉じられません**(×ボタン・Escでは閉じない、常に最前面)。

- 通知時刻を複数設定可能
- 「いつもの持ち物」(毎日)+「特別な持ち物」(日付指定で事前登録、その日だけ追加)
- 設定画面から編集。常駐中でも設定は自動反映

## iPhone で使う(Webアプリ版 / `web/`)
iPhone には Python が無いため、同じ機能を **ホーム画面に追加できる Webアプリ(PWA)** として `web/` に用意しました。
サーバー不要で、設定はiPhone内(localStorage)に保存されます。

### 1. 公開する(GitHub Pages)
1. GitHub のリポジトリ → Settings → Pages → Source を **GitHub Actions** にする
2. `web/` を変更して push するか、Actions タブの「Deploy web app to GitHub Pages」を手動実行
3. `https://<ユーザー名>.github.io/<リポジトリ名>/` で開ける(HTTPS必須)

### 2. iPhone に入れる
Safari で上のURLを開く → 共有ボタン →「ホーム画面に追加」。設定画面で通知時刻・持ち物・特別な持ち物(日付指定)を登録。

### 3. 毎日自動で開く(重要)
iPhoneのWebアプリは、閉じている間に自分でポップアップを出せません(iOSの制限)。
代わりに「ショートカット」アプリで、決めた時刻にアプリを自動で開きます:
「オートメーション」→ ＋ →「時刻」→ アクション「URLを開く」に `https://…/?check=1` を設定 →「実行前に確認」オフ。
(アプリ内の設定画面にURLのコピー欄があります。通知時刻ごとにオートメーションを作ってください)

開くと全画面のチェックリストが出て、**全項目にチェックするまで「確認OK」を押せません**。
アプリを開いたままなら、設定時刻になった時にも自動で表示されます。

※ iOSの仕様上、ホームボタン等でアプリを切り替えれば画面から離れることはできます(強制的に閉じられなくすることはできません)。

## デスクトップ版(Python / tkinter)
### 必要なもの
Python 3.9+ と tkinter(Windows/macOS の標準Pythonには同梱。Linuxは `sudo apt install python3-tk`)。外部ライブラリ不要。

### 使い方
```
python -m mochimono settings   # 設定画面(時刻・持ち物・特別な持ち物)
python -m mochimono run        # 常駐して時刻に通知(既定)
python -m mochimono test       # 今日のリストを今すぐ表示して動作確認
```
設定は `~/.mochimono/config.json`(環境変数 `MOCHIMONO_DIR` で変更可)。

PC起動が予定時刻に遅れた場合も、60分以内なら起動時に通知します。

### 自動起動
- Windows: `pythonw -m mochimono run` のショートカットを `shell:startup` フォルダに置く
- macOS: ログイン項目 or launchd に `python3 -m mochimono run` を登録
- Linux: 自動起動アプリケーションに `python3 -m mochimono run` を追加

## テスト
`python -m unittest discover -s tests` / `node --test test/logic.test.js`
