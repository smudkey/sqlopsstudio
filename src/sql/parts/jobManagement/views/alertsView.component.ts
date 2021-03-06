/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/grid/media/slickColorTheme';
import 'vs/css!sql/parts/grid/media/flexbox';
import 'vs/css!sql/parts/grid/media/styles';
import 'vs/css!sql/parts/grid/media/slick.grid';
import 'vs/css!sql/parts/grid/media/slickGrid';
import 'vs/css!../common/media/jobs';
import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!sql/base/browser/ui/table/media/table';

import { Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, AfterContentChecked } from '@angular/core';
import * as sqlops from 'sqlops';
import * as nls from 'vs/nls';
import { Table } from 'sql/base/browser/ui/table/table';
import { AgentViewComponent } from 'sql/parts/jobManagement/agent/agentView.component';
import * as dom from 'vs/base/browser/dom';
import { IJobManagementService } from '../common/interfaces';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { ICommandService } from 'vs/platform/commands/common/commands';
export const VIEW_SELECTOR: string = 'jobalertsview-component';
export const ROW_HEIGHT: number = 45;

@Component({
	selector: VIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./alertsView.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => AlertsViewComponent) }],
})
export class AlertsViewComponent implements AfterContentChecked {

	private columns: Array<Slick.Column<any>> = [
		{ name: nls.localize('jobAlertColumns.name', 'Name'), field: 'name', width: 200, id: 'name' },
		{ name: nls.localize('jobAlertColumns.lastOccurrenceDate', 'Last Occurrence'), field: 'lastOccurrenceDate', width: 200, id: 'lastOccurrenceDate' },
		{ name: nls.localize('jobAlertColumns.enabled', 'Enabled'), field: 'enabled', width: 200, id: 'enabled' },
		{ name: nls.localize('jobAlertColumns.databaseName', 'Database Name'), field: 'databaseName', width: 200, id: 'databaseName' },
		{ name: nls.localize('jobAlertColumns.categoryName', 'Category Name'), field: 'categoryName', width: 200, id: 'categoryName' },
	];

	private options: Slick.GridOptions<any> = {
		syncColumnCellResize: true,
		enableColumnReorder: false,
		rowHeight: 45,
		enableCellNavigation: true,
		editable: false
	};

	private dataView: any;

	@ViewChild('jobalertsgrid') _gridEl: ElementRef;
	private isVisible: boolean = false;
	private isInitialized: boolean = false;
	private isRefreshing: boolean = false;
	private _table: Table<any>;
	public alerts: sqlops.AgentAlertInfo[];
	private _serverName: string;
	private _isCloud: boolean;
	private _showProgressWheel: boolean;

	private NewAlertText: string = nls.localize('jobAlertToolbar-NewJob', "New Alert");
	private RefreshText: string = nls.localize('jobAlertToolbar-Refresh', "Refresh");

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _dashboardService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(forwardRef(() => AgentViewComponent)) private _agentViewComponent: AgentViewComponent,
		@Inject(IJobManagementService) private _jobManagementService: IJobManagementService,
		@Inject(IThemeService) private _themeService: IThemeService,
		@Inject(ICommandService) private _commandService: ICommandService
	) {
		this._isCloud = this._dashboardService.connectionManagementService.connectionInfo.serverInfo.isCloud;
	}

	public layout() {
		this._table.layout(new dom.Dimension(dom.getContentWidth(this._gridEl.nativeElement), dom.getContentHeight(this._gridEl.nativeElement)));
	}

	ngAfterContentChecked() {
		if (this.isVisible === false && this._gridEl.nativeElement.offsetParent !== null) {
			this.isVisible = true;
			if (!this.isInitialized) {
				this._showProgressWheel = true;
				this.onFirstVisible(false);
				this.isInitialized = true;
			}
		} else if (this.isVisible === true && this._agentViewComponent.refresh === true) {
			this._showProgressWheel = true;
			this.onFirstVisible(false);
			this.isRefreshing = true;
			this._agentViewComponent.refresh = false;
		} else if (this.isVisible === true && this._gridEl.nativeElement.offsetParent === null) {
			this.isVisible = false;
		}
	}

	onFirstVisible(cached?: boolean) {
		let self = this;
		let columns = this.columns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});
		let options = <Slick.GridOptions<any>>{
			syncColumnCellResize: true,
			enableColumnReorder: false,
			rowHeight: ROW_HEIGHT,
			enableCellNavigation: true,
			forceFitColumns: true
		};

		this.dataView = new Slick.Data.DataView();

		$(this._gridEl.nativeElement).empty();
		this._table = new Table(this._gridEl.nativeElement, undefined, columns, this.options);
		this._table.grid.setData(this.dataView, true);

		let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
		this._jobManagementService.getAlerts(ownerUri).then((result) => {
			if (result && result.alerts) {
				self.alerts = result.alerts;
				self.onAlertsAvailable(result.alerts);
			}
		});
	}

	private onAlertsAvailable(alerts: sqlops.AgentAlertInfo[]) {
		let items: any = alerts.map((item) => {
			return {
				id: item.id,
				name: item.name,
				lastOccurrenceDate: item.lastOccurrenceDate,
				enabled: item.isEnabled,
				databaseName: item.databaseName,
				categoryName: item.categoryName
			};
		});

		this.dataView.beginUpdate();
		this.dataView.setItems(items);
		this.dataView.endUpdate();
		this._table.autosizeColumns();
		this._table.resizeCanvas();

		this._showProgressWheel = false;
		this._cd.detectChanges();
	}

	private openCreateJobDialog() {
		let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
		this._commandService.executeCommand('agent.openCreateAlertDialog', ownerUri);
	}

	private refreshJobs() {
		this._agentViewComponent.refresh = true;
	}
}