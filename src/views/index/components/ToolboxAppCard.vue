<script setup lang="ts">
import { useRouter } from 'vue-router';
import SvgIcon from '@/components/SvgIcon/index.vue';

defineOptions({ name: 'ToolboxAppCard' });

interface Props {
  /** 应用名称 */
  name: string;
  /** 点击后跳转的路由路径（仅 installed 时有效） */
  path: string;
  /** 是否已安装：已安装可点击跳转、正常色；未安装置灰并显示圆形进度 */
  installed?: boolean;
  /** 图标名（可选）：项目内 SvgIcon 名称，如 iEL-home-filled */
  icon?: string;
  /** 图标资源（可选）：图片/SVG 的 URL 或模块路径，支持 .svg / .png / .jpg / .webp 等 */
  iconSrc?: string;
  /** 安装进度 0–100，未安装时显示；先仿造占位，后续由你接入真实逻辑 */
  installProgress?: number;
}

const props = withDefaults(defineProps<Props>(), {
  installed: false,
  installProgress: 0,
});

const router = useRouter();

function onClick() {
  if (!props.installed) return;
  router.push(props.path);
}
</script>

<template>
  <div
    class="app-card flex flex-col items-center justify-center p-4 min-h-[100px] select-none"
    :class="installed ? 'app-card--installed' : 'app-card--disabled'"
    @click="onClick"
  >
    <!-- 图标区域 -->
    <div class="app-card__icon">
      <slot v-if="$slots.icon" name="icon" />
      <img
        v-else-if="iconSrc"
        :src="iconSrc"
        :alt="name"
        class="w-full h-full object-contain select-none pointer-events-none"
        draggable="false"
      />
      <SvgIcon
        v-else-if="icon"
        :name="icon"
        class="app-card__svg-icon"
      />
      <span
        v-else
        class="text-xl font-semibold text-gray-600 dark:text-gray-300 select-none"
      >
        {{ name.charAt(0) }}
      </span>
    </div>
    <span class="app-card__label">{{ name }}</span>
  </div>
</template>

<style scoped>
/* ---- 卡片基础 ---- */
.app-card {
  border-radius: 1rem;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.25s ease,
              opacity 0.25s ease,
              filter 0.25s ease;
  will-change: transform;
}

/* ---- 已安装：hover 抬起 + 按下回弹 ---- */
.app-card--installed {
  cursor: pointer;
}
.app-card--installed:hover {
  transform: scale(1.08) translateY(-2px);
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
}
.app-card--installed:hover .app-card__icon {
  background: rgb(0 0 0 / 0.07);
}
:root.dark .app-card--installed:hover .app-card__icon {
  background: rgb(255 255 255 / 0.14);
}
.app-card--installed:active {
  transform: scale(0.95);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.08);
}

/* ---- 未安装：置灰 + hover 微动画提示可安装 ---- */
.app-card--disabled {
  cursor: default;
  opacity: 0.55;
  filter: grayscale(1);
}
.app-card--disabled:hover {
  opacity: 0.7;
  filter: grayscale(0.7);
  transform: scale(1.04);
}

/* ---- 图标容器 ---- */
.app-card__icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;   /* 56px */
  height: 3.5rem;
  border-radius: 0.75rem;
  background: rgb(0 0 0 / 0.04);
  margin-bottom: 0.5rem;
  overflow: hidden;
  transition: inherit;  /* 跟随卡片动画 */
}
:root.dark .app-card__icon {
  background: rgb(255 255 255 / 0.08);
}

/* ---- SvgIcon 撑满容器 ---- */
.app-card__svg-icon {
  font-size: 2.5rem;  /* 40px，与容器 56px 配合留出内边距 */
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
:deep(.app-card__svg-icon svg) {
  width: 100%;
  height: 100%;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ---- 名称 ---- */
.app-card__label {
  font-size: 0.75rem;
  text-align: center;
  color: var(--el-text-color-regular, #606266);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
  transition: color 0.25s ease;
}
</style>
