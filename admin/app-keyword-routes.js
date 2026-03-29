(function attachKeywordRouteManager() {
  function createManager(deps) {
    const {
      state,
      dom,
      api,
      createLocalId,
      currentStory,
      render,
      reloadAll,
      clearDirty,
      setPendingAction,
      markDirty,
      nextNodeOptions,
      sectionHeading,
      createField,
      input,
      select,
      textarea,
      imageInput,
      createBlockingNotice
    } = deps;

    function keywordBindingActionType(binding) {
      return ['story', 'carousel', 'transition'].includes(binding?.actionType) ? binding.actionType : 'story';
    }

    function keywordBindingScope(binding) {
      return binding?.scope === 'account' ? 'account' : 'story';
    }

    function allKeywordBindings() {
      return Array.isArray(state.globalSettings?.triggerBindings)
        ? state.globalSettings.triggerBindings
        : [];
    }

    function accountKeywordBindings() {
      return allKeywordBindings().filter((binding) => keywordBindingScope(binding) === 'account');
    }

    function currentTriggerBinding() {
      if (!state.globalSettings || !state.currentStoryId) return null;
      return state.globalSettings.triggerBindings.find((binding) =>
        keywordBindingScope(binding) === 'story'
        && binding.storyId === state.currentStoryId
        && keywordBindingActionType(binding) === 'story'
      ) || null;
    }

    function currentTriggerKeyword() {
      return `${currentTriggerBinding()?.keyword || currentStory()?.triggerKeyword || ''}`.trim();
    }

    function currentStoryTriggerHint() {
      const keyword = currentTriggerKeyword();
      return keyword
        ? `這裡只會更新目前故事自己的啟動 keyword。現在正式值是「${keyword}」。帳號共用指令請到 Setting。`
        : '這裡只會更新目前故事自己的啟動 keyword。像「顯示繪本故事」這類帳號共用指令請到 Setting。';
    }

    function findKeywordBinding(bindingId = '') {
      return accountKeywordBindings().find((binding) => binding.id === bindingId) || null;
    }

    function findStoryById(storyId = '') {
      return (state.stories || []).find((story) => story.id === storyId)
        || (currentStory()?.id === storyId ? currentStory() : null)
        || null;
    }

    function syncCarouselBindingStoryIds(binding) {
      binding.storyIds = Array.from(new Set((binding.carouselItems || []).map((item) => item.storyId).filter(Boolean)));
    }

    function createCarouselItemDraft(story = null, fallbackButtonLabel = '開始閱讀') {
      return {
        id: createLocalId('carousel-item'),
        storyId: story?.id || '',
        title: story?.title || '',
        subtitle: story?.description || (story ? `開始故事「${story.title || '未命名故事'}」` : ''),
        buttonLabel: fallbackButtonLabel || '開始閱讀',
        imagePath: '',
        sortOrder: 0
      };
    }

    function createKeywordBindingDraft(actionType = 'story') {
      const type = keywordBindingActionType({ actionType });
      const firstStory = state.stories?.[0] || null;
      return {
        id: createLocalId('trigger'),
        scope: 'account',
        actionType: type,
        label: type === 'carousel' ? '故事選單' : type === 'transition' ? '過場訊息' : '開始故事',
        keyword: '',
        messageText: '',
        storyId: '',
        startNodeId: '',
        buttonLabel: type === 'carousel' ? '開始閱讀' : '',
        storyIds: type === 'carousel' && firstStory ? [firstStory.id] : [],
        carouselItems: type === 'carousel' && firstStory ? [{
          id: createLocalId('carousel-item'),
          storyId: firstStory.id,
          title: firstStory.title || '',
          subtitle: firstStory.description || `開始故事「${firstStory.title || '未命名故事'}」`,
          buttonLabel: '開始閱讀',
          imagePath: '',
          sortOrder: 0
        }] : []
      };
    }

    function handleAddKeywordBinding(actionType = 'story') {
      if (!state.globalSettings) return;
      const binding = createKeywordBindingDraft(actionType);
      state.globalSettings.triggerBindings.push(binding);
      state.currentKeywordBindingId = binding.id;
      state.settingStatus = '已新增 account trigger，尚未儲存。';
      markDirty('關鍵字路由已新增，尚未儲存。');
      render();
    }

    function updateKeywordBindingField(bindingId, field, value) {
      const binding = (state.globalSettings?.triggerBindings || []).find((entry) => entry.id === bindingId);
      if (!binding) return;
      binding[field] = value;
      if (field === 'actionType') {
        binding.label = value === 'carousel' ? '故事選單' : value === 'transition' ? '過場訊息' : '開始故事';
        if (binding.actionType === 'story') {
          const targetStory = state.stories.find((story) => story.id === binding.storyId) || null;
          binding.storyId = targetStory?.id || '';
          binding.startNodeId = targetStory?.startNodeId || targetStory?.nodes?.[0]?.id || '';
        } else {
          binding.storyId = '';
          binding.startNodeId = '';
        }
        if (binding.actionType === 'carousel') {
          binding.buttonLabel = binding.buttonLabel || '開始閱讀';
          binding.carouselItems = Array.isArray(binding.carouselItems) ? binding.carouselItems : [];
          syncCarouselBindingStoryIds(binding);
        }
      }
      if (field === 'storyId') {
        const targetStory = state.stories.find((story) => story.id === value) || null;
        binding.startNodeId = targetStory?.startNodeId || targetStory?.nodes?.[0]?.id || '';
      }
      state.settingStatus = 'account trigger 已修改，尚未儲存。';
      markDirty('關鍵字路由已修改，尚未儲存。');
      render();
    }

    function deleteKeywordBinding(bindingId) {
      const bindings = state.globalSettings?.triggerBindings || [];
      const index = bindings.findIndex((entry) => entry.id === bindingId);
      if (index === -1) return;
      const [binding] = bindings.splice(index, 1);
      if (binding?.id === state.currentKeywordBindingId) {
        state.currentKeywordBindingId = '';
      }
      state.settingStatus = 'account trigger 已刪除，尚未儲存。';
      markDirty('關鍵字路由已刪除，尚未儲存。');
      render();
    }

    function addCarouselItem(bindingId) {
      const binding = (state.globalSettings?.triggerBindings || []).find((entry) => entry.id === bindingId);
      if (!binding) return;
      const usedStoryIds = new Set((binding.carouselItems || []).map((item) => item.storyId).filter(Boolean));
      const nextStory = (state.stories || []).find((story) => !usedStoryIds.has(story.id)) || state.stories?.[0] || null;
      const nextItem = createCarouselItemDraft(nextStory, binding.buttonLabel || '開始閱讀');
      nextItem.sortOrder = (binding.carouselItems || []).length;
      binding.carouselItems = [...(binding.carouselItems || []), nextItem];
      syncCarouselBindingStoryIds(binding);
      state.settingStatus = 'carousel 卡片已新增，尚未儲存。';
      markDirty('carousel 卡片已新增，尚未儲存。');
      render();
    }

    function updateCarouselItemField(bindingId, itemId, field, value) {
      const binding = (state.globalSettings?.triggerBindings || []).find((entry) => entry.id === bindingId);
      const item = binding?.carouselItems?.find((entry) => entry.id === itemId);
      if (!binding || !item) return;
      item[field] = value;
      if (field === 'storyId') {
        const story = findStoryById(value);
        item.title = story?.title || item.title || '';
        item.subtitle = story?.description || item.subtitle || (story ? `開始故事「${story.title || '未命名故事'}」` : '');
      }
      syncCarouselBindingStoryIds(binding);
      state.settingStatus = 'carousel 卡片已修改，尚未儲存。';
      markDirty('carousel 卡片已修改，尚未儲存。');
      render();
    }

    function moveCarouselItem(bindingId, itemId, direction) {
      const binding = (state.globalSettings?.triggerBindings || []).find((entry) => entry.id === bindingId);
      if (!binding?.carouselItems?.length) return;
      const items = binding.carouselItems.slice().sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));
      const index = items.findIndex((item) => item.id === itemId);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= items.length) return;
      [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
      binding.carouselItems = items.map((item, order) => ({
        ...item,
        sortOrder: order
      }));
      syncCarouselBindingStoryIds(binding);
      state.settingStatus = 'carousel 卡片順序已修改，尚未儲存。';
      markDirty('carousel 卡片順序已修改，尚未儲存。');
      render();
    }

    function removeCarouselItem(bindingId, itemId) {
      const binding = (state.globalSettings?.triggerBindings || []).find((entry) => entry.id === bindingId);
      if (!binding?.carouselItems?.length) return;
      binding.carouselItems = binding.carouselItems
        .filter((item) => item.id !== itemId)
        .map((item, order) => ({
          ...item,
          sortOrder: order
        }));
      syncCarouselBindingStoryIds(binding);
      state.settingStatus = 'carousel 卡片已刪除，尚未儲存。';
      markDirty('carousel 卡片已刪除，尚未儲存。');
      render();
    }

    async function handleSaveAccountSettings() {
      if (!state.globalSettings) return;
      setPendingAction('save-account-settings');
      state.settingStatus = '正在儲存 account triggers...';
      render();
      try {
        const result = await api('/global-settings/triggers', {
          method: 'PUT',
          body: JSON.stringify({ triggerBindings: state.globalSettings.triggerBindings })
        });
        state.globalSettings.triggerBindings = result.triggerBindings || [];
        await reloadAll();
        clearDirty('Setting 已儲存。');
        state.lastActionResult = 'saved';
        state.settingStatus = 'Setting 已儲存。';
        render();
      } catch (error) {
        state.lastActionResult = 'error';
        state.settingStatus = `Setting 儲存失敗：${error.message}`;
        render();
        throw error;
      } finally {
        setPendingAction('');
      }
    }

    function renderSettingOverview() {
      if (!dom.settingRouteOverview) return;
      const storiesById = new Map((state.stories || []).map((story) => [story.id, story]));
      const bindings = accountKeywordBindings();
      if (!bindings.some((binding) => binding.id === state.currentKeywordBindingId)) {
        state.currentKeywordBindingId = bindings[0]?.id || '';
      }
      if (dom.keywordBindingTabs) {
        dom.keywordBindingTabs.innerHTML = bindings.length
          ? bindings.map((binding) => `
              <button class="keyword-tab ${binding.id === state.currentKeywordBindingId ? 'active' : ''}" data-keyword-binding-id="${binding.id}">
                ${binding.keyword || binding.label || '未命名 route'}
              </button>
            `).join('')
          : '';
        Array.from(dom.keywordBindingTabs.querySelectorAll('[data-keyword-binding-id]')).forEach((button) => {
          button.addEventListener('click', () => {
            state.currentKeywordBindingId = button.dataset.keywordBindingId || '';
            renderSettingOverview();
            renderSettingEditor();
          });
        });
      }
      if (dom.settingStatus) {
        dom.settingStatus.textContent = state.settingStatus || '這裡編輯的是全帳號共用 trigger route。';
      }
      if (dom.saveAccountSettings) {
        dom.saveAccountSettings.textContent = state.pendingAction === 'save-account-settings' ? '儲存中...' : '儲存帳號指令';
        dom.saveAccountSettings.disabled = !state.globalSettings;
        dom.saveAccountSettings.title = '只會儲存全帳號共用的 keyword route，不會改動目前故事內容。';
      }
      dom.settingRouteOverview.innerHTML = bindings.length
        ? bindings.map((binding) => {
            const type = keywordBindingActionType(binding);
            const target = binding.storyId
              ? (storiesById.get(binding.storyId)?.title || binding.storyId)
              : '未指定故事';
            const detail = type === 'story'
              ? `target: ${target} / start node: ${binding.startNodeId || '未設定'}`
              : type === 'transition'
                ? (binding.messageText || '未設定過場訊息')
                : `carousel / cards: ${binding.carouselItems?.length || binding.storyIds?.length || 0} / button: ${binding.buttonLabel || '開始閱讀'}`;
            return `
              <article class="story-card ${binding.id === state.currentKeywordBindingId ? 'active' : ''}" data-setting-binding-card="${binding.id}">
                <div class="row space-between">
                  <div class="story-title">${binding.keyword || '未設定 keyword'}</div>
                  <span class="pill">${type}</span>
                </div>
                <div class="subtle">Scope: Account Command</div>
                <div class="field-hint">${detail}</div>
              </article>
            `;
          }).join('')
        : '<div class="status-box">目前沒有任何 account-level trigger route。</div>';
      Array.from(dom.settingRouteOverview.querySelectorAll('[data-setting-binding-card]')).forEach((card) => {
        card.addEventListener('click', () => {
          state.currentKeywordBindingId = card.dataset.settingBindingCard || '';
          renderSettingOverview();
          renderSettingEditor();
        });
      });
    }

    function renderSettingEditor() {
      if (!dom.keywordBindingEditor) return;
      const binding = findKeywordBinding(state.currentKeywordBindingId);
      if (!binding) {
        dom.keywordBindingEditor.innerHTML = '<div class="status-box">尚未建立 account-level trigger。點上方按鈕新增一組 keyword。</div>';
        return;
      }

      const actionType = keywordBindingActionType(binding);
      const targetStory = findStoryById(binding.storyId) || state.stories?.[0] || null;
      const storyOptions = [['', '未指定'], ...(state.stories || []).map((story) => [story.id, story.title || story.id])];
      const startNodeOptions = targetStory
        ? nextNodeOptions(targetStory)
        : [['', '請先選擇故事']];

      const shell = document.createElement('section');
      shell.className = 'keyword-editor-card';

      const header = document.createElement('div');
      header.className = 'row space-between';
      header.appendChild(sectionHeading('編輯帳號指令'));
      const actions = document.createElement('div');
      actions.className = 'actions';
      const deleteButton = document.createElement('button');
      deleteButton.className = 'button ghost';
      deleteButton.textContent = '刪除帳號指令';
      deleteButton.addEventListener('click', () => deleteKeywordBinding(binding.id));
      actions.appendChild(deleteButton);
      header.appendChild(actions);
      shell.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'field-grid';
      grid.append(
        createField('Keyword', input(binding.keyword || '', (value) => updateKeywordBindingField(binding.id, 'keyword', value))),
        createField('動作類型', select([
          ['story', '故事入口'],
          ['transition', '過場訊息'],
          ['carousel', '故事 Carousel']
        ], actionType, (value) => updateKeywordBindingField(binding.id, 'actionType', value))),
        createField('顯示標籤', input(binding.label || '', (value) => updateKeywordBindingField(binding.id, 'label', value)))
      );

      if (actionType === 'story') {
        grid.append(
          createField('目標故事', select(storyOptions, binding.storyId || '', (value) => updateKeywordBindingField(binding.id, 'storyId', value))),
          createField('起始節點', select(startNodeOptions, binding.startNodeId || '', (value) => updateKeywordBindingField(binding.id, 'startNodeId', value)))
        );
        grid.appendChild(createField('說明', deps.staticValue('收到這組 keyword 後，LINE 會直接從指定故事的起始節點開始。'), 'single'));
      } else if (actionType === 'transition') {
        grid.appendChild(createField('過場訊息', textarea(binding.messageText || '', (value) => updateKeywordBindingField(binding.id, 'messageText', value)), 'single'));
      } else {
        grid.append(
          createField('導覽訊息', textarea(binding.messageText || '', (value) => updateKeywordBindingField(binding.id, 'messageText', value)), 'single'),
          createField('預設按鈕文字', input(binding.buttonLabel || '開始閱讀', (value) => updateKeywordBindingField(binding.id, 'buttonLabel', value)))
        );
        shell.appendChild(grid);

        const carouselSection = document.createElement('div');
        carouselSection.className = 'stack';
        const carouselHeader = document.createElement('div');
        carouselHeader.className = 'row space-between';
        carouselHeader.appendChild(sectionHeading('Carousel 卡片設計'));
        const addButton = document.createElement('button');
        addButton.className = 'button secondary';
        addButton.textContent = '＋ 新增故事卡片';
        addButton.addEventListener('click', () => addCarouselItem(binding.id));
        carouselHeader.appendChild(addButton);
        carouselSection.appendChild(carouselHeader);

        const items = (binding.carouselItems || []).slice().sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));
        if (!items.length) {
          carouselSection.appendChild(createBlockingNotice('尚未加入任何 carousel 卡片。'));
        } else {
          items.forEach((item, index) => {
            const itemStory = findStoryById(item.storyId);
            const panel = document.createElement('section');
            panel.className = 'panel';
            panel.style.padding = '14px';

            const panelHeader = document.createElement('div');
            panelHeader.className = 'row space-between';
            panelHeader.appendChild(sectionHeading(`卡片 ${index + 1}`));
            const panelActions = document.createElement('div');
            panelActions.className = 'actions';

            const moveUp = document.createElement('button');
            moveUp.className = 'button ghost';
            moveUp.textContent = '上移';
            moveUp.disabled = index === 0;
            moveUp.addEventListener('click', () => moveCarouselItem(binding.id, item.id, -1));
            panelActions.appendChild(moveUp);

            const moveDown = document.createElement('button');
            moveDown.className = 'button ghost';
            moveDown.textContent = '下移';
            moveDown.disabled = index === items.length - 1;
            moveDown.addEventListener('click', () => moveCarouselItem(binding.id, item.id, 1));
            panelActions.appendChild(moveDown);

            const remove = document.createElement('button');
            remove.className = 'button ghost';
            remove.textContent = '刪除';
            remove.addEventListener('click', () => removeCarouselItem(binding.id, item.id));
            panelActions.appendChild(remove);

            panelHeader.appendChild(panelActions);
            panel.appendChild(panelHeader);

            const panelGrid = document.createElement('div');
            panelGrid.className = 'field-grid';
            panelGrid.append(
              createField(
                '故事',
                select(storyOptions, item.storyId || '', (value) => updateCarouselItemField(binding.id, item.id, 'storyId', value))
              ),
              createField('卡片標題', input(item.title || '', (value) => updateCarouselItemField(binding.id, item.id, 'title', value))),
              createField('按鈕文字', input(item.buttonLabel || binding.buttonLabel || '開始閱讀', (value) => updateCarouselItemField(binding.id, item.id, 'buttonLabel', value))),
              createField('自訂封面', imageInput(item.imagePath || '', (value) => updateCarouselItemField(binding.id, item.id, 'imagePath', value))),
              createField('卡片說明', textarea(item.subtitle || itemStory?.description || '', (value) => updateCarouselItemField(binding.id, item.id, 'subtitle', value)), 'single')
            );
            panel.appendChild(panelGrid);
            carouselSection.appendChild(panel);
          });
        }
        shell.appendChild(carouselSection);
        dom.keywordBindingEditor.innerHTML = '';
        dom.keywordBindingEditor.appendChild(shell);
        return;
      }

      shell.appendChild(grid);
      dom.keywordBindingEditor.innerHTML = '';
      dom.keywordBindingEditor.appendChild(shell);
    }

    return {
      keywordBindingActionType,
      keywordBindingScope,
      currentTriggerBinding,
      currentTriggerKeyword,
      currentStoryTriggerHint,
      accountKeywordBindings,
      findKeywordBinding,
      findStoryById,
      createKeywordBindingDraft,
      handleAddKeywordBinding,
      updateKeywordBindingField,
      deleteKeywordBinding,
      addCarouselItem,
      updateCarouselItemField,
      moveCarouselItem,
      removeCarouselItem,
      handleSaveAccountSettings,
      renderSettingOverview,
      renderSettingEditor
    };
  }

  window.LineatAdminKeywordRoutes = {
    createManager
  };
})();
