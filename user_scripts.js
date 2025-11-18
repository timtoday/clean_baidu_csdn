// ==UserScript==
// @name         终极屏蔽CSDN（支持百度企业号/Shadow DOM）
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  支持百度企业号、Base64、关键词、文本匹配、Shadow DOM穿透
// @author       You
// @match        *://*.baidu.com/s?*
// @match        *://www.google.com/search*
// @match        *://cn.bing.com/search*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const BLOCKED_KEYWORDS = ['csdn', 'CSDN', 'blog.csdn'];

    // 判断字符串是否包含任一关键词（不区分大小写）
    function hasKeyword(str) {
        if (!str) return false;
        const lower = str.toLowerCase();
        return BLOCKED_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
    }

    // 尝试从链接提取真实目标（Base64、query 参数等）
    function extractTargetUrl(href) {
        try {
            const url = new URL(href);

            // 检查常见跳转参数
            for (const param of ['url', 'q', 'target', 'link', 'jump', 'redirect']) {
                const val = url.searchParams.get(param);
                if (val && hasKeyword(val)) return val;
                try {
                    const decoded = decodeURIComponent(val || '');
                    if (hasKeyword(decoded)) return decoded;
                } catch (e) {}
            }

            // Base64 解码尝试
            const base64Match = href.match(/(base64|enc)=([^&]+)/i);
            if (base64Match) {
                const b64 = base64Match[2].replace(/_/g, '/').replace(/-/g, '+');
                try {
                    const decoded = atob(b64);
                    if (hasKeyword(decoded)) return decoded;
                } catch (e) {}
            }

        } catch (e) {
            // URL 解析失败忽略
        }
        return href;
    }

    // 检查元素本身或其子元素是否应被屏蔽
    function isElementBlocked(el) {
        if (!el || !el.querySelector) return false;

        // 1. 检查所有文本内容
        const text = el.textContent || '';
        if (hasKeyword(text)) return true;

        // 2. 检查 class/id
        const className = el.className?.toString() || '';
        const id = el.id || '';
        if (hasKeyword(className) || hasKeyword(id)) return true;

        // 3. 检查所有 a 标签的 href 和跳转目标
        const links = el.querySelectorAll('a[href]');
        for (const a of links) {
            const href = a.getAttribute('href') || '';
            if (hasKeyword(href)) return true;
            if (hasKeyword(extractTargetUrl(href))) return true;
        }

        return false;
    }

    // 主要清理函数
    function cleanResults() {
        let selectors = '';

        if (window.location.host.includes('baidu.com')) {
            selectors = '#content_left .c-container, #content_left div[data-click], #rs .result';
        } else if (window.location.host.includes('bing.com')) {
            selectors = '#b_results li.b_algo';
        } else if (window.location.host.includes('google.com')) {
            selectors = 'div.g, article, div[data-content-feature]';
        }

        // 清理标准结果
        if (selectors) {
            document.querySelectorAll(selectors).forEach(el => {
                if (isElementBlocked(el)) {
                    el.remove(); // 直接删除更彻底
                }
            });
        }

        // 🔥 特别处理：百度企业号 / 垂直卡片（可能藏在 Shadow DOM 里）
        handleBaiduEnterpriseCards();
    }

    // 💣 专门处理百度企业号、知识图谱、卡片类内容
    function handleBaiduEnterpriseCards() {
        if (!window.location.host.includes('baidu.com')) return;

        // 查找所有疑似“企业号”或“内容聚合”的区块
        const candidates = document.querySelectorAll('.ec_tuiguang, .ec_card, .result-op, .c-result');

        candidates.forEach(el => {
            // 检查是否有 dataset 或 innerHTML 包含 CSDN
            const dataAttr = JSON.stringify(el.dataset || {});
            const html = el.innerHTML || '';

            if (hasKeyword(dataAttr) || hasKeyword(html) || hasKeyword(el.textContent)) {
                // 特别注意：有些卡片是通过 shadowRoot 加载的
                if (el.shadowRoot) {
                    const shadowContent = el.shadowRoot.textContent || '';
                    if (hasKeyword(shadowContent)) {
                        el.remove();
                        return;
                    }
                }

                // 移除整个卡片
                if (el.parentNode) {
                    el.remove();
                }
            }
        });
    }

    // 使用 MutationObserver 监听动态插入的内容
    new MutationObserver((mutations) => {
        // 延迟执行，确保 DOM 完全渲染
        setTimeout(cleanResults, 300);
    }).observe(document.body, {
        childList: true,
        subtree: true
    });

    // 页面加载后立即运行一次
    window.addEventListener('load', () => setTimeout(cleanResults, 500));
    setTimeout(cleanResults, 500); // 初始执行
})();
