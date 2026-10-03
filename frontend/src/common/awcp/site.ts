import type { AwcpSiteInfo } from '@app/awcp';

import { describePage } from './contracts';
import { SCENARIO_GROUPS } from '../scenarios/catalog';
import type { AppRoute } from '../../pc/routes/route';

const CATALOG_SITE: AwcpSiteInfo = {
  name: '站内导航',
  description: describePage({
    purpose: '浏览通用办公、证券业务和协议实验的场景目录。',
    regions: '按场景类型列出 ID、业务名称、技术验证重点与可访问地址，可搜索。',
    flow: '打开目标场景后重新读取 AWCP 目录。',
    limits: '导航不触发业务流程；所有数据均为虚构。'
  })
};

const NOT_FOUND_SITE: AwcpSiteInfo = {
  name: '未找到场景',
  description: describePage({
    purpose: '提示未知地址。',
    regions: '可返回场景目录。',
    flow: '返回目录后选择有效场景。',
    limits: '当前地址没有业务操作。'
  })
};

export function siteForRoute(route: AppRoute): AwcpSiteInfo {
  if (route.kind === 'catalog') return CATALOG_SITE;
  if (route.kind === 'analysis') return { name: '演示历史数据分析', description: describePage({ purpose: '按条件查询虚构历史业务样本。', regions: '查询条件、汇总指标、分组图表和分页明细。', flow: '设置条件查询，点击分组钻取明细。', limits: '只读历史样本，不代表当前办理记录。' }) };
  if (route.kind === 'not-found') return NOT_FOUND_SITE;

  if (route.scenario.group !== 'protocol' && route.scenario.id !== 'O01' && !route.objectId && !route.formType) {
    return {
      name: `${route.scenario.id} ${route.scenario.title} · 事项列表`,
      description: describePage({
        purpose: '选择已有业务事项或进入实际支持的发起表单。',
        regions: '事项编号、标题、当前状态和可用发起入口。',
        flow: '根据用户任务选择事项；进入新页面后重新发现当前页 AWCP 能力。',
        limits: '列表页不暴露详情办理 Action；虚构数据仅供演示。'
      })
    };
  }
  if (route.formType) {
    return {
      name: `${route.scenario.id} ${route.scenario.title} · ${route.formType} 发起表单`,
      description: describePage({
        purpose: '由用户任务发起新业务事项，逐字段填写空白表单。',
        regions: '当前表单类型、必填控件与提交反馈。',
        flow: '填完必填项后提交；进入新记录详情页后重新发现 AWCP 能力。',
        limits: '示例话术不会触发固定流程；不预填业务输入。'
      })
    };
  }

  if (route.objectId && route.scenario.group !== 'protocol' && route.scenario.id !== 'O01') {
    return {
      name: `${route.scenario.id} ${route.scenario.title} · ${route.objectId} 事项详情`,
      description: describePage({
        purpose: '查看所选虚构业务事项的当前状态、业务内容和处理记录，并按用户任务继续办理。',
        regions: `当前事项：${route.objectId}；关联业务对象可按需跨场景核对。`,
        flow: '只操作当前事项；跨场景或跨事项导航后重新发现当前页 AWCP 能力。',
        limits: '不自动运行示例任务；当前业务办理仍使用会话隔离的浏览器数据，后端迁移尚未完成。'
      })
    };
  }

  if (route.scenario.id === 'O01') {
    return {
      name: 'O01 工作台与待办',
      description: describePage({
        purpose: '按虚构时钟查询、处理和汇总到期待办。',
        regions: `当前业务对象：${route.objectId ?? '全部可见待办'}；列表按操作人和优先级筛选。`,
        flow: '查询可见待办，处理本人名下的已提交差旅或通用单据，再按日期汇总日报。',
        limits: '其他来源的待办须在对应业务页面处理；数据仅为虚构演示。'
      })
    };
  }


  if (route.scenario.id === 'P01') {
    return {
      name: 'P01 两层发现与标准调用',
      description: describePage({
        purpose: '隔离演示真实 Core 的页面目录、动作章节和标准调用。',
        regions: '目录、章节样例及只读回显结果。',
        flow: '以当前 revision 读取动作章节，然后按章节样例调用。',
        limits: '本实验不写入演示业务数据。'
      })
    };
  }

  if (route.scenario.id === 'P02') {
    return {
      name: 'P02 Schema 与字段错误',
      description: describePage({
        purpose: '隔离演示真实 Core 对嵌套资料草稿的静态 Schema 校验。',
        regions: '合法样例与缺字段、类型、额外字段、嵌套数组错误。',
        flow: '先读取章节 Schema，再以当前 revision 调用合法和非法输入。',
        limits: '校验失败发生在动作执行前，页面不写入业务数据。'
      })
    };
  }

  if (route.scenario.id === 'P03') {
    return {
      name: 'P03 只读动态校验',
      description: describePage({
        purpose: '隔离演示人员 ID、会议时间冲突和演示额度的动态校验。',
        regions: '当前业务快照、合法样例和三种动态错误。',
        flow: '先读取手册章节，再以当前 revision 分别尝试合法与冲突输入。',
        limits: '校验只读取业务快照，版本化额度仅用于演示。'
      })
    };
  }

  if (route.scenario.id === 'P04') {
    return {
      name: 'P04 revision 与合同更新',
      description: describePage({
        purpose: '隔离演示合同变化与普通页面渲染对 Core revision 的影响。',
        regions: '选择、筛选、刷新和合同版本按钮。',
        flow: '先记录 revision，再操作普通控件和合同版本按钮，对比目录、章节与调用。',
        limits: '本实验不写入业务数据。'
      })
    };
  }

  if (route.scenario.id === 'P05') {
    return {
      name: 'P05 生命周期与多实例',
      description: describePage({
        purpose: '隔离演示真实 Core 动作注册、停用、卸载、重复 ID 与跨页取消。',
        regions: '动作启停、重复注册与等待调用。',
        flow: '读取目录、停用与重启动作，随后发起等待调用并导航离开。',
        limits: '动作只读；取消只表示调用终止，不表示回滚。'
      })
    };
  }

  if (route.scenario.id === 'P06') {
    return {
      name: 'P06 异步取消与迟到结果',
      description: describePage({
        purpose: '隔离演示真实 Core 在执行前和执行中取消异步动作。',
        regions: '提交、状态查询和迟到结果释放。',
        flow: '分别取消 before 与 during 调用，每次取消后查询业务状态。',
        limits: '取消不回滚已经完成的业务写入。'
      })
    };
  }

  if (route.scenario.id === 'P07') {
    return {
      name: 'P07 重复请求与业务幂等',
      description: describePage({
        purpose: '隔离比较 Core requestId 在途去重与 S05 持久业务幂等键。',
        regions: '需求版本、合法样例与响应释放按钮。',
        flow: '先用同 requestId 测在途去重，再用不同业务键和原业务键分别重放。',
        limits: '完成后的 requestId 可复用；业务幂等由 idempotencyKey 保证。'
      })
    };
  }

  if (route.scenario.id === 'P08') {
    return {
      name: 'P08 受控错误与异常归一',
      description: describePage({
        purpose: '隔离演示真实 Core 保留受控 action.* 错误并归一普通异常。',
        regions: '成功、受控错误和普通异常。',
        flow: '读取章节后分别调用三种模式，比较代码、消息与详情。',
        limits: '错误实验只读，不写业务状态。'
      })
    };
  }

  if (route.scenario.id === 'P09') {
    return {
      name: 'P09 动态合同与最新状态',
      description: describePage({
        purpose: '隔离演示字段配置更新 Schema、样例与最新闭包。',
        regions: '配置按钮、普通渲染与等待调用。',
        flow: '对比普通渲染、合同更新和已受理调用完成后的结果。',
        limits: '动作只读；已受理调用不会因之后的合同更新自动重新校验。'
      })
    };
  }

  if (route.scenario.id === 'P10') {
    return {
      name: 'P10 容量与隔离',
      description: describePage({
        purpose: '隔离演示真实 Core 的 Action 数、目录和章节容量限制。',
        regions: '私有容量探针、原子拒绝结果与页面健康检查。',
        flow: '执行三个探针后，继续调用当前页 ping 并切换其他场景。',
        limits: '探针 registry 与页面 registry 隔离，超限错误不应破坏全站。'
      })
    };
  }

  const group = SCENARIO_GROUPS.find((entry) => entry.id === route.scenario.group);
  return {
    name: `${route.scenario.id} ${route.scenario.title}`,
    description: describePage({
      purpose: `${route.scenario.title}场景。`,
      regions: `${group?.title ?? '示例'}场景；当前业务对象：${route.objectId ?? '未选择'}。`,
      flow: '场景任务实施后，可在此页完成相应业务操作。',
      limits: '此场景当前仅有路由与作用域，尚未注册业务操作。'
    })
  };
}
