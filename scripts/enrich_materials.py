"""Verified corrections and Chinese translations for the user-provided sentence cards."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
p = ROOT / 'web/data/cards.json'
cards = json.loads(p.read_text(encoding='utf-8'))
by_id = {c['id']: c for c in cards}

def bind(id, sentence, focus, suffix=''):
    by_id[id].update(sentence=sentence, focus=focus)
    by_id[id]['originalRef'] += suffix

bind('c17-t1-p1-005', by_id['c17-t1-p1-003']['sentence'], 'resulted in')
bind('c17-t1-p1-030', by_id['c17-t1-p1-032']['sentence'], 'argued that')
bind('c17-t1-p1-087', 'Building the railway would make it possible to move people to better housing in the [2 ____].', 'housing', ' · 原题 Notes Completion 第 2 题（方括号表示原空格）')
bind('c17-t1-p2-001', by_id['c17-t1-p2-002']['sentence'], 'the public')
bind('c17-t1-p2-022', by_id['c17-t1-p2-023']['sentence'], 'amphitheatre')
question = 'It is now a market square with [22 ____] and homes incorporated into the remains of the Roman amphitheatre.'
bind('c17-t1-p2-124', question, 'incorporated into', ' · 原题 Summary Completion 第 22 题（方括号表示原空格）')
bind('c17-t1-p2-125', question, 'the remains of', ' · 原题 Summary Completion 第 22 题（方括号表示原空格）')
glossary = '(especially in Greek and Roman architecture) an open circular or oval building with a central space surrounded by tiers of seats for spectators, for the presentation of dramatic or sporting events'
for n, focus in [(67, 'an open circular'), (68, 'oval building'), (69, 'tiers of seats'), (70, 'spectators'), (71, 'dramatic or sporting events')]:
    bind(f'c17-t1-p2-{n:03}', glossary, focus, ' · 原文 amphitheatre 脚注')
    by_id[f'c17-t1-p2-{n:03}']['fragment'] = True

# Each key matches a complete verified sentence, never an adapted example.
translations = [
('In the first half', '19世纪上半叶，伦敦人口以惊人的速度增长，市中心变得越来越拥挤。'),
('In addition, the expansion', '此外，地面铁路网的扩张使越来越多的乘客涌入首都。'),
('The result was that', '结果，地面铁路车站在伦敦城周围形成了一个环。'),
('The area within', '环内是建筑简陋、过度拥挤的贫民窟，街道上挤满了马车。'),
('It could take an hour', '乘坐马车或公共马车行驶8公里，可能要花一个半小时。'),
('Numerous schemes', '人们提出了许多方案来解决这些问题，但成功的很少。'),
('Amongst the most vocal', '最积极倡导解决伦敦交通问题的人中，有一位是为伦敦城工作的律师查尔斯·皮尔逊。'),
('He saw both social', '他认为，修建一条连接地面各火车站的地下铁路，同时清理伦敦贫民窟，会带来社会和经济两方面的好处。'),
('His idea was to', '他的想法是把住在内城贫民窟的贫穷工人迁到新建郊区，并为他们提供廉价铁路交通以便上班。'),
('Pearson’s ideas', '皮尔逊的想法得到了部分商人的支持，他于1851年向议会提交了一份计划。'),
('It was rejected', '这份计划被否决了，但恰逢另一群人提出修建地下连接线的方案，而议会通过了后者。'),
('The two groups', '两群人合并，于1854年8月成立了大都会铁路公司。'),
('The organisation had', '该组织难以为这个如此激进且昂贵的方案筹资，尤其是因为报刊刊登了批评文章。'),
('Objectors argued', '反对者声称，隧道会在上方交通的重压下坍塌，建筑物会受到震动，乘客会被火车引擎的排放物毒害。'),
('The GWR, aware', '大西部铁路公司意识到新线路终于能让列车开进伦敦城中心，因此向该方案投入了近25万英镑。'),
('Eventually, over', '最终，经过五年，共筹集了100万英镑。'),
('The chosen route', '选定的路线从现有主要道路下方经过，以尽量减少拆除建筑物的开支。'),
('It was built just', '它采用一种称为“明挖回填”的技术，修建在紧靠街面下方的位置。'),
('A trench about', '人们挖出一条约十米宽、六米深的沟槽，侧壁用木梁临时支撑。'),
('Brick walls were', '随后建起砖墙，最后加上砖拱，形成隧道。'),
('A two-metre-deep', '隧道上方铺了两米厚的土层，并重建了上面的道路。'),
('Even as the Metropolitan', '就在大都会铁路开始运营时，第一批延长线已在获批；它们在接下来的五年中建成，东至伦敦的沼泽门，西至哈默史密斯。'),
('The original plan', '最初的计划是用蒸汽机车牵引列车，在锅炉中使用耐火砖提供蒸汽，但这些引擎从未投入使用。'),
('Instead, the line', '相反，该线路使用了专门设计的机车，装有能使蒸汽冷凝的水箱。'),
('However, smoke', '然而，尽管隧道中增设了通风井，烟和废气仍然是问题。'),
('Despite the extension', '尽管地下铁路不断延伸，到19世纪80年代，伦敦街头的拥堵却更加严重。'),
('The problem was partly', '部分问题在于，现有地铁线路绕伦敦中心形成环线并延伸到郊区，却没有横穿首都中心。'),
('The only alternative', '唯一的替代办法是在地下深处挖掘隧道。'),
('Although the technology', '尽管当时已有建造这类隧道的技术，蒸汽机车却无法用于如此狭窄的空间。'),
('It wasn’t until', '直到可靠的电动机以及将电力从发电机传到行驶中列车的方法出现，世界上第一条深层电气铁路——伦敦城与南伦敦铁路——才成为可能。'),
('The trains were', '列车由三节车厢组成，由电力引擎驱动。'),
('The carriages were', '车厢很窄，只有紧靠车顶下方的小窗，因为当时认为乘客不会想向外看隧道壁。'),
('The line was not', '这条线路并非没有问题，主要是电力供应不可靠所致。'),
('Although the City', '尽管伦敦城与南伦敦铁路是重大的技术成就，它却没有盈利。'),
('Then, in 1900', '随后，1900年，俗称“两便士地铁”的伦敦中央铁路开始运营，使用新型电力机车。'),
('It was very popular', '它非常受欢迎，不久之后，新的铁路和延长线就加入了日益扩展的地铁网络。'),
('By 1907', '到1907年，如今伦敦地铁系统的核心部分已建成。'),
('Building the railway', '修建铁路将使人们能够迁往位于[第2题空格]的更好住房。'),
('Stadiums are among', '体育场是最古老的城市建筑形式之一：早在古希腊和古罗马帝国时期，供公众观看体育赛事的大型体育场就已处于西方城市生活的中心，远早于后来主导城市天际线的宏伟中世纪教堂和19、20世纪的大火车站。'),
('Today, however', '然而，如今人们对体育场的质疑日益增加。'),
('Construction costs', '建设成本可能飙升至超过10亿英镑，而为奥运会或国际足联世界杯等重大赛事建成的体育场，已有不少明显陷入闲置和失修。'),
('But this need', '但情况不一定非得如此。'),
('History shows', '历史表明，体育场能够推动城市发展，并适应各个时代的文化。'),
('Even today, architects', '即使在今天，建筑师和规划师仍在寻找新方法，改造那些在20世纪成为现代化象征的单一功能体育场馆。'),
('The amphitheatre of Arles', '法国西南部阿尔勒的圆形竞技场可容纳25,000名观众，也许是最能说明体育场用途究竟有多灵活的例子。'),
('Built by the Romans', '它由罗马人于公元90年建造，5世纪后变为带有四座塔楼的堡垒，随后又改成了拥有200多所房屋的村落。'),
('With the growing interest', '19世纪，随着人们日益重视保护古迹，它又被改回举办斗牛的竞技场，使这座建筑恢复了作为公众观赏活动场所的最初用途。'),
('Another example', '另一个例子是意大利北部维罗纳那座宏伟的竞技场，可容纳30,000名观众，比阿尔勒竞技场早建60年，比罗马著名的斗兽场早建40年。'),
('It has endured', '它历经数个世纪，如今凭借出色的音响效果，被认为是世界上最重要的歌剧演出场地之一。'),
('The area in the centre', '意大利小城卢卡中心的圆形竞技场广场，是圆形竞技场融入城市肌理的又一个令人印象深刻的例子。'),
('The site evolved', '这个场地以与阿尔勒类似的方式演变，从中世纪到19世纪逐渐被建筑填满，先后用作住宅、盐仓和监狱。'),
('But rather than', '但它没有恢复为竞技场，而是成为由浪漫主义建筑师洛伦佐·诺托利尼设计的集市广场。'),
('Today, the ruins', '如今，竞技场遗迹仍嵌在公共广场周围的各种商店和住宅之中。'),
('There are many similarities', '现代体育场与古代用于比赛的圆形竞技场有许多相似之处。'),
('But some of the flexibility', '然而，20世纪初，体育场采用钢材、钢筋混凝土等新材料建造，并用明亮的灯光举行夜间比赛时，它们失去了一部分灵活性。'),
('(especially in Greek', '（尤指古希腊和古罗马建筑）一种露天圆形或椭圆形建筑，中央场地被层层观众座席包围，用于戏剧表演或体育赛事。'),
('Many such stadiums', '许多这样的体育场位于郊区，只为体育用途设计，周围环绕着停车场。'),
('These factors mean', '这些因素意味着，普通公众可能不太容易前往这些场馆，而且它们运行时需要更多能源，并加剧城市热量积聚。'),
('But many of today', '但当今许多最具创新意识的建筑师认为，体育场有潜力帮助改善城市。'),
('Among the current strategies', '在现行策略中，两种似乎特别成功：把体育场变成城市枢纽，或变成发电站。'),
('There’s a growing trend', '体育场越来越多地配备超越体育用途的公共空间和服务，例如酒店、零售商店、会议中心、餐厅和酒吧、儿童游乐场及绿地。'),
('Creating mixed-use', '建设这样的混合用途项目，可以增强紧凑性和多功能性，更高效地利用土地，并帮助复兴城市空间。'),
('This opens the space', '这使场地向家庭和社会更广泛的人群开放，而不是只服务于运动员和支持者。'),
('There have been many examples', '英国已有很多这样的例子：温布利和老特拉福德的混合用途设施，已成为世界上许多其他体育场的蓝本。'),
('The phenomenon', '体育场作为发电站这一现象源于这样的想法：通过智能电网整合相互连接的建筑，可以克服能源问题；智能电网是一种利用数字通信技术检测并响应当地用电变化、且没有显著能量损失的供电网络。'),
('Stadiums are ideal', '体育场很适合这些用途，因为其顶棚有很大的表面积安装光伏板，而且高度足够高（超过40米），可以利用微型风力涡轮机。'),
('Freiburg Mage', '德国弗赖堡的Mage Solar体育场是新一批兼作发电站的体育场中的第一座，这一批还包括阿姆斯特丹竞技场和高雄体育场。'),
('The latter, inaugurated', '后者于2009年启用，拥有8,844块光伏板，每年最多可产生1.14吉瓦时的电力。'),
('This reduces the annual', '这每年可减少660吨二氧化碳排放，并在体育场不使用时，为周边地区提供最高80%的用电。'),
('This is proof', '这证明体育场能够服务所在城市，并在减少二氧化碳排放方面产生明确的积极影响。'),
('Sporting arenas', '体育场馆一直是城市生活和文化的核心。'),
('In every era', '每个时代，体育场都会获得新的价值与用途：从军事堡垒到居住村落，从公共空间到剧院，最近又成为先进工程的试验场。'),
('The stadium of today', '如今的体育场汇集了多种功能，从而帮助城市创造可持续的未来。'),
('It is now a market', '它如今是一个集市广场，[第22题空格]和住宅被融入罗马圆形竞技场的遗迹之中。'),
]
listening_translations = [
'你将听到若干段不同的录音。','你需要根据听到的内容回答问题。','会留出时间让你阅读说明和问题。','你还将有机会检查自己的答案。','考试分为四个部分。','在考试结束时。','一名旅行代理人与一位顾客之间。','你会看到一个已为你完成的示例。','我想了解一些美国自驾游的信息。','顾客名叫安德烈娅·布朗，所以布朗已经被填入空格中。','现在我们开始。','你应该边听边回答问题，因为录音不会播放第二遍。','请仔细听，并回答第1至第6题。','留手机号码可以吗？','我可以问一下，你是从哪里听说World Tours的？','还是你在哪里看到了广告？','不是，我是在报纸上读到你们的信息的。','好的，我会把宣传册邮寄给你。','我有兴趣和家人一起去加利福尼亚。','我们在那里有几条自驾游路线，可以游览加利福尼亚各处不同的景点。','第一条路线从洛杉矶开始，有充足的时间游览那里的一些主题公园。','那是我孩子们想去的地方，所以我想把它包括进去。','在那里住上几个晚上。','你可以选择住小屋，或者住在露营地。','我不喜欢住帐篷的想法，会太热。','旅行在拉斯维加斯结束。','我们能安排的另一条路线略有不同，从旧金山开始。','然后你向南开到坎布里亚。','有人告诉我，坎布里亚附近有一座很漂亮的城堡。我们会经过那附近吗？','就在那条路上，所以你可以在那里停留。','这条路线也会进入沙漠吗？','圣莫尼卡，大多数人喜欢在那里停留并购物。','我们在家就已经有够多这类活动了，所以那对我们没有吸引力。','你也可以直接前往圣迭戈。','那里适合去海滩，对吗？','那是放松的好地方，你的孩子们在乘飞机回家前也许会想去动物园。','那些不包括在内。但这些酒店的价格包含晚餐。','等我有机会看过宣传册后，再与你联系。',
]
ipa = {'congested':'/kənˈdʒestɪd/','slums':'/slʌmz/','housing':'/ˈhaʊzɪŋ/','tiny':'/ˈtaɪni/','Parliament':'/ˈpɑːləmənt/','trench':'/trentʃ/','dug':'/dʌɡ/','fumes':'/fjuːmz/','minimise':'/ˈmɪnɪmaɪz/','versatile':'/ˈvɜːsətaɪl/','amphitheatre':'/ˈæmfɪˌθɪətə/','fortress':'/ˈfɔːtrəs/','bullfights':'/ˈbʊlfaɪts/','spectators':'/spekˈteɪtəz/','phenomenon':'/fəˈnɒmɪnən/','canopies':'/ˈkænəpiz/','disuse':'/dɪsˈjuːs/','disrepair':'/ˌdɪsrɪˈpeə/','modernisation':'/ˌmɒdənaɪˈzeɪʃən/','emblematic':'/ˌembləˈmætɪk/','Romanticist':'/rəʊˈmæntɪsɪst/'}
missing = []
for c in cards:
    if c['kind'] == 'listening':
        n = int(c['id'].rsplit('-', 1)[1])
        c['translation'] = listening_translations[n-1]
        c['meaning'] = c['translation']
        # The complete note preserves connected-speech IPA and the user's corrections.
        import re
        match = re.search(r'/[^/]+/', c['note'])
        c['ipa'] = match.group() if match else ''
    else:
        for prefix, translation in translations:
            if c['sentence'].startswith(prefix):
                c['translation'] = translation
                break
        else: missing.append(c['id'] + ': ' + c['sentence'])
        c['ipa'] = ipa.get(c['target'], '')
    # All original cards are from materials the user provided; generated translations are supplementary.
    c['origin'] = '个人学习笔记 · 原句已对照本地剑雅材料 · 译文为学习辅助'
p.write_text(json.dumps(cards, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Enriched {len(cards)} cards; missing translations: {len(missing)}')
for item in missing: print(item)
