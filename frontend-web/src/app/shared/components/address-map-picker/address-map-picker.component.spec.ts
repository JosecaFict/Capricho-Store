import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AddressMapPickerComponent } from './address-map-picker.component';

describe('AddressMapPickerComponent', () => {
  let component: AddressMapPickerComponent;
  let fixture: ComponentFixture<AddressMapPickerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AddressMapPickerComponent],
    });

    fixture = TestBed.createComponent(AddressMapPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders search bar and GPS button for location picking', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.map-search-input')).toBeTruthy();
    expect(el.querySelector('.map-btn--gps')?.textContent).toContain('Usar mi ubicación actual');
    expect(el.querySelector('.map-canvas')).toBeTruthy();
  });

  it('emits locationSelected when coordinates are set', () => {
    const spy = vi.fn();
    component.locationSelected.subscribe(spy);

    // Simulate selecting Santa Cruz coordinates
    component['updatePosition'](-17.7833, -63.1821, false);

    expect(spy).toHaveBeenCalledWith({
      lat: -17.7833,
      lng: -63.1821,
    });
    expect(component.currentLat()).toBe(-17.7833);
    expect(component.currentLng()).toBe(-63.1821);
  });
});
